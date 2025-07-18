// File: /api/linkedin-profiles.js (Using the CORRECT /datasets/v3/trigger endpoint)

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const { urls } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'An array of LinkedIn URLs is required.' });
    }

    const apiKey = process.env.BRIGHTDATA_API_KEY;
    const datasetId = process.env.BRIGHTDATA_DATASET_ID; // This is correct for this endpoint

    if (!apiKey || !datasetId) {
        console.error("CRITICAL: BrightData environment variables not set.");
        return res.status(500).json({ error: 'BrightData API credentials are not configured on the server.' });
    }

    try {
        // --- THIS IS THE ENDPOINT FROM YOUR WORKING EXAMPLE ---
        const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&include_errors=true`;
        
        console.log(`[linkedin-profiles] Triggering BrightData job for ${urls.length} URLs at: ${triggerUrl}`);

        const triggerResponse = await fetch(triggerUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(urls.map(url => ({ url }))),
        });

        console.log(`[linkedin-profiles] BrightData trigger response status: ${triggerResponse.status}`);
        const responseData = await triggerResponse.json();
        console.log(`[linkedin-profiles] BrightData trigger response JSON:`, responseData);

        if (!triggerResponse.ok) {
            throw new Error(`BrightData trigger failed: ${JSON.stringify(responseData)}`);
        }

        const snapshotId = responseData.snapshot_id;

        if (!snapshotId) {
            throw new Error("BrightData response did not contain a snapshot_id.");
        }

        console.log(`[linkedin-profiles] Successfully triggered job. Snapshot ID: ${snapshotId}`);
        
        // Immediately return the snapshot_id to the client
        return res.status(202).json({ snapshot_id: snapshotId }); // 202 Accepted

    } catch (error) {
        console.error("[linkedin-profiles] Error in trigger function:", error.message);
        return res.status(502).json({ error: `Failed to trigger BrightData job: ${error.message}` });
    }
};