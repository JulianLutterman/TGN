// File: /api/linkedin-profiles.js (NOW ONLY TRIGGERS THE JOB)

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
    const datasetId = process.env.BRIGHTDATA_PEOPLE_DATASET_ID;

    if (!apiKey || !datasetId) {
        console.error("CRITICAL: BrightData environment variables not set.");
        return res.status(500).json({ error: 'BrightData API credentials are not configured on the server.' });
    }

    try {
        // The trigger endpoint is different for async collection
        const triggerUrl = `https://api.brightdata.com/dca/trigger_and_get_result_url?dataset=${datasetId}`;
        
        console.log(`[linkedin-profiles] Triggering BrightData job for ${urls.length} URLs.`);

        const triggerResponse = await fetch(triggerUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(urls.map(url => ({ url }))),
        });

        const responseText = await triggerResponse.text();
        console.log(`[linkedin-profiles] BrightData trigger response status: ${triggerResponse.status}`);
        console.log(`[linkedin-profiles] BrightData trigger response body: ${responseText}`);

        if (!triggerResponse.ok) {
            throw new Error(`BrightData trigger failed with status ${triggerResponse.status}: ${responseText}`);
        }

        // The response from this endpoint is the delivery ID directly.
        // It's not a JSON object, it's just a string.
        const deliveryId = responseText.trim();

        if (!deliveryId) {
            throw new Error("BrightData did not return a delivery_id in the response body.");
        }

        console.log(`[linkedin-profiles] Successfully triggered job. Delivery ID: ${deliveryId}`);
        
        // Immediately return the delivery_id to the client
        return res.status(202).json({ delivery_id: deliveryId }); // 202 Accepted

    } catch (error) {
        console.error("[linkedin-profiles] Error triggering BrightData:", error.message);
        return res.status(502).json({ error: `Failed to trigger BrightData job: ${error.message}` });
    }
};