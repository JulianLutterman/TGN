// File: /api/linkedin-profiles.js (CORRECTED TRIGGER URL)

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
    const datasetId = process.env.BRIGHTDATA_DATASET_ID;

    if (!apiKey || !datasetId) {
        console.error("CRITICAL: BrightData environment variables not set.");
        return res.status(500).json({ error: 'BrightData API credentials are not configured on the server.' });
    }

    try {
        // --- THIS IS THE CORRECTED URL ---
        const triggerUrl = `https://api.brightdata.com/dca/trigger?dataset=${datasetId}`;
        
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

        if (!triggerResponse.ok) {
            const errorText = await triggerResponse.text();
            console.error(`[linkedin-profiles] BrightData trigger failed. Body: ${errorText}`);
            throw new Error(`BrightData trigger failed with status ${triggerResponse.status}: ${errorText}`);
        }

        // The response from this endpoint is a JSON object containing the delivery_id
        const triggerData = await triggerResponse.json();
        console.log(`[linkedin-profiles] BrightData trigger response JSON:`, triggerData);

        const deliveryId = triggerData.delivery_id;

        if (!deliveryId) {
            throw new Error("BrightData response did not contain a delivery_id.");
        }

        console.log(`[linkedin-profiles] Successfully triggered job. Delivery ID: ${deliveryId}`);
        
        // Immediately return the delivery_id to the client
        return res.status(202).json({ delivery_id: deliveryId }); // 202 Accepted

    } catch (error) {
        console.error("[linkedin-profiles] Error in trigger function:", error.message);
        return res.status(502).json({ error: `Failed to trigger BrightData job: ${error.message}` });
    }
};