// File: /api/linkedin-results.js (Simplified to just return current data)

module.exports = async (req, res) => {
    const { snapshot_id } = req.query;
    if (!snapshot_id) {
        return res.status(400).json({ error: 'A snapshot_id is required.' });
    }

    const apiKey = process.env.BRIGHTDATA_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'BrightData API key is not configured.' });
    }

    try {
        const resultsUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}?format=json`;
        const resultsResponse = await fetch(resultsUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
        });

        // If the snapshot isn't ready or doesn't exist yet, it might return a non-200 status.
        // In this case, we simply return an empty array. The client will know to poll again.
        if (resultsResponse.status !== 200) {
            return res.status(200).json([]); // Return empty array, client will retry
        }

        const results = await resultsResponse.json();
        
        // Simply return whatever results are available right now.
        return res.status(200).json(results);

    } catch (error) {
        console.error(`[linkedin-results] Error polling for results: ${error.message}`);
        // On error, also return an empty array so the client can retry gracefully.
        return res.status(200).json([]);
    }
};