// A helper function to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async (req, res) => {
    // This function only accepts POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    // --- 1. Get Credentials and Input ---
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'An array of LinkedIn URLs is required.' });
    }

    const apiKey = process.env.BRIGHTDATA_API_KEY;
    const datasetId = process.env.BRIGHTDAT_DATASET_ID; // Use a specific env var for the people dataset

    if (!apiKey || !datasetId) {
        console.error("CRITICAL: BrightData environment variables not set.");
        return res.status(500).json({ error: 'BrightData API credentials are not configured on the server.' });
    }

    // --- 2. Trigger BrightData Collection ---
    let deliveryId;
    try {
        const triggerResponse = await fetch(`https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&include_errors=true`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(urls.map(url => ({ url }))), // Format URLs for BrightData
        });

        if (!triggerResponse.ok) {
            const errorData = await triggerResponse.text();
            console.error("BrightData trigger failed:", errorData);
            throw new Error(`BrightData trigger failed with status ${triggerResponse.status}.`);
        }

        const triggerData = await triggerResponse.json();
        deliveryId = triggerData.delivery_id;
        if (!deliveryId) {
            throw new Error("BrightData did not return a delivery_id.");
        }
    } catch (error) {
        console.error("Error triggering BrightData:", error.message);
        return res.status(502).json({ error: `Failed to trigger BrightData job: ${error.message}` });
    }

    // --- 3. Poll for Results ---
    let results = null;
    const maxWaitTime = 90000; // 90 seconds max wait
    const pollInterval = 5000; // 5 seconds
    let elapsedTime = 0;

    while (elapsedTime < maxWaitTime) {
        await sleep(pollInterval);
        elapsedTime += pollInterval;

        try {
            const resultsResponse = await fetch(`https://api.brightdata.com/datasets/v3/results?dataset_id=${datasetId}&delivery_id=${deliveryId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
            });

            if (resultsResponse.status === 200) {
                const responseData = await resultsResponse.json();
                if (responseData && responseData.length > 0) {
                    results = responseData;
                    break; // Success! Exit the loop.
                }
                // If response is 200 but empty, it's still processing, so we continue waiting.
            } else if (resultsResponse.status !== 202) { // 202 means "Accepted, still processing"
                // Any other error status should stop the process.
                const errorText = await resultsResponse.text();
                console.error(`Polling failed with status ${resultsResponse.status}:`, errorText);
                throw new Error(`Polling failed with status ${resultsResponse.status}.`);
            }
        } catch (error) {
            console.error("Error polling for BrightData results:", error.message);
            return res.status(502).json({ error: `Failed to poll for results: ${error.message}` });
        }
    }

    if (!results) {
        return res.status(408).json({ error: 'Request timed out waiting for LinkedIn data from BrightData.' });
    }

    // --- 4. Process and Sanitize Data ---
    try {
        const processedProfiles = results.map(profile => {
            if (!profile.name) return null; // Skip profiles that failed to scrape properly

            return {
                input_url: profile.input_url,
                name: profile.name || 'N/A',
                title: profile.position || 'N/A',
                experience: (profile.experience || []).map(exp => ({
                    job_title: exp.title || 'N/A',
                    company: exp.subtitle || 'N/A',
                    duration: exp.duration || 'N/A',
                    description: exp.description || 'No description provided.'
                })),
                education: (profile.education || []).map(edu => ({
                    degree: edu.degree || 'N/A',
                    school: edu.title || 'N/A', // 'title' is the institute name
                    field: edu.field || 'N/A'
                }))
            };
        }).filter(Boolean); // Filter out any null entries

        return res.status(200).json(processedProfiles);

    } catch (error) {
        console.error("Error processing BrightData results:", error.message);
        return res.status(500).json({ error: `Failed to process the data received from BrightData.` });
    }
};