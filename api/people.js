// File: /api/people.js

// Helper function to call the Bright Data API
async function fetchLinkedInData(linkedinUrls) {
    const apiKey = process.env.BRIGHTDATA_API_KEY;
    const datasetId = process.env.BRIGHTDATA_DATASET_ID;

    if (!apiKey || !datasetId) {
        console.error("Bright Data API Key or Dataset ID is not configured.");
        // Return empty array to avoid crashing the whole request
        return [];
    }

    // IMPORTANT: The '/trigger' endpoint is ASYNCHRONOUS. It starts a job but doesn't
    // return the data immediately. For a real-world app, you'd need to poll for results
    // or use a webhook. For a synchronous result, you would use a different Bright Data
    // product like the "Scraper API" and a different endpoint.
    // This example proceeds as if the response were synchronous for demonstration.
    const brightDataUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&include_errors=true`;

    // Format the URLs for the Bright Data API
    const requestBody = linkedinUrls.map(url => ({ "url": url }));

    try {
        const response = await fetch(brightDataUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Bright Data API returned an error:", errorText);
            return []; // Return empty on error
        }
        
        // Assuming a synchronous response for this example
        const data = await response.json();
        // The actual response from '/trigger' is just a confirmation.
        // If this were a synchronous API, the scraped data would be here.
        // We will proceed assuming `data` is the array of scraped profiles.
        return data.results || data; // Adjust based on actual synchronous API response structure

    } catch (error) {
        console.error("Error calling Bright Data API:", error);
        return [];
    }
}


module.exports = async (req, res) => {
    const { companyId } = req.query;

    if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
    }

    const specterApiKey = process.env.SPECTER_API_KEY;
    if (!specterApiKey) {
        return res.status(500).json({ error: 'Specter API key is not configured.' });
    }

    try {
        // STEP 1: Get founders from Specter
        const peopleListUrl = `https://app.tryspecter.com/api/v1/companies/${companyId}/people?founders=true`;
        const peopleListResponse = await fetch(peopleListUrl, {
            headers: { 'X-API-Key': specterApiKey },
        });

        if (!peopleListResponse.ok) throw new Error('Failed to fetch founders from Specter.');
        const peopleList = await peopleListResponse.json();
        if (!peopleList || peopleList.length === 0) return res.status(200).json([]);

        // STEP 2: Get detailed profiles for each founder from Specter
        const personDetailPromises = peopleList.map(person => {
            const personDetailUrl = `https://app.tryspecter.com/api/v1/people/${person.person_id}`;
            return fetch(personDetailUrl, { headers: { 'X-API-Key': specterApiKey } })
                .then(response => response.ok ? response.json() : null);
        });
        const detailedPeople = (await Promise.all(personDetailPromises)).filter(p => p !== null);

        // STEP 3: Enrich with Bright Data
        const linkedinUrls = detailedPeople
            .map(p => p.linkedin_url)
            .filter(url => url); // Filter out any null/undefined URLs

        let linkedInData = [];
        if (linkedinUrls.length > 0) {
            // This is where we would get the real data in a synchronous model
            // For now, we are calling our helper function.
            // In a real async model, you would just return the Specter data
            // and have the frontend poll for the Bright Data results.
            // linkedInData = await fetchLinkedInData(linkedinUrls);
        }
        
        // For demonstration, we'll just return the Specter data for now.
        // To make this fully work, you need a synchronous Bright Data API endpoint.
        // The frontend code below is written to handle the combined data once you have it.
        
        // --- HYPOTHETICAL MERGE LOGIC ---
        // const linkedInDataMap = new Map(linkedInData.map(item => [item.input_url, item]));
        // const enrichedPeople = detailedPeople.map(person => ({
        //     ...person,
        //     linkedin_data: linkedInDataMap.get(person.linkedin_url) || null,
        // }));
        // return res.status(200).json(enrichedPeople);
        
        // For now, returning only Specter data so the app doesn't break.
        // The frontend is ready for the enriched data when you have a sync API.
        return res.status(200).json(detailedPeople);


    } catch (error) {
        console.error(`Server-side orchestration for people failed: ${error.message}`);
        return res.status(500).json({ error: `Server error: ${error.message}` });
    }
};