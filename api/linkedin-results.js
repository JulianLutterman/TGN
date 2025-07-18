// File: /api/linkedin-results.js (NEW FILE TO POLL FOR RESULTS)

module.exports = async (req, res) => {
    const { delivery_id } = req.query;
    if (!delivery_id) {
        return res.status(400).json({ error: 'A delivery_id is required.' });
    }

    const apiKey = process.env.BRIGHTDATA_API_KEY;
    const datasetId = process.env.BRIGHTDATA_DATASET_ID;

    if (!apiKey || !datasetId) {
        console.error("CRITICAL: BrightData environment variables not set.");
        return res.status(500).json({ error: 'BrightData API credentials are not configured on the server.' });
    }

    try {
        const resultsUrl = `https://api.brightdata.com/dca/dataset_delivery?dataset_id=${datasetId}&delivery_id=${delivery_id}`;
        console.log(`[linkedin-results] Polling for delivery_id: ${delivery_id}`);

        const resultsResponse = await fetch(resultsUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
        });

        console.log(`[linkedin-results] Poll response status: ${resultsResponse.status}`);

        if (resultsResponse.status === 202) {
            // 202 means the job is still running. This is expected.
            return res.status(202).json({ status: 'processing' });
        }

        if (resultsResponse.status === 200) {
            // 200 means the job is done and we have data.
            const results = await resultsResponse.json();
            console.log(`[linkedin-results] Data received for ${delivery_id}. Processing...`);

            // Process and sanitize the data right here before sending to client
            const processedProfiles = results.map(profile => {
                if (!profile.name) return null;
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
                        school: edu.title || 'N/A',
                        field: edu.field || 'N/A'
                    }))
                };
            }).filter(Boolean);

            return res.status(200).json({ status: 'complete', data: processedProfiles });
        }

        // Any other status is an error.
        const errorText = await resultsResponse.text();
        throw new Error(`Polling failed with status ${resultsResponse.status}: ${errorText}`);

    } catch (error) {
        console.error(`[linkedin-results] Error polling for results: ${error.message}`);
        return res.status(500).json({ error: `Failed to poll for results: ${error.message}` });
    }
};