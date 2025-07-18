// File: /api/linkedin-results.js (Polling the CORRECT snapshot endpoint)

module.exports = async (req, res) => {
    const { snapshot_id } = req.query;
    if (!snapshot_id) {
        return res.status(400).json({ error: 'A snapshot_id is required.' });
    }

    const apiKey = process.env.BRIGHTDATA_API_KEY;

    if (!apiKey) {
        console.error("CRITICAL: BRIGHTDATA_API_KEY not set.");
        return res.status(500).json({ error: 'BrightData API key is not configured.' });
    }

    try {
        const resultsUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}?format=json`;
        console.log(`[linkedin-results] Polling for snapshot_id: ${snapshot_id}`);

        const resultsResponse = await fetch(resultsUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
        });

        console.log(`[linkedin-results] Poll response status: ${resultsResponse.status}`);

        // According to docs, this endpoint returns 200 when ready, and might return other statuses while processing.
        // A common pattern is to get a non-200 status until the data is fully prepared.
        if (resultsResponse.status === 200) {
            const results = await resultsResponse.json();
            console.log(`[linkedin-results] Data received for ${snapshot_id}. Processing...`);

            if (!results || results.length === 0) {
                // This can happen if the job is "done" but produced no data. Treat as still processing for a bit.
                 return res.status(202).json({ status: 'processing' });
            }

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
        } else {
            // Any other status (like 404 while it's being created) means it's not ready.
            return res.status(202).json({ status: 'processing' });
        }

    } catch (error) {
        console.error(`[linkedin-results] Error polling for results: ${error.message}`);
        return res.status(500).json({ error: `Failed to poll for results: ${error.message}` });
    }
};