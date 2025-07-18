// File: /api/people.js

module.exports = async (req, res) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  // --- API Key Configuration ---
  const specterApiKey = process.env.SPECTER_API_KEY;
  const brightdataApiKey = process.env.BRIGHTDATA_API_KEY;
  const brightdataDatasetId = process.env.BRIGHTDATA_DATASET_ID;

  if (!specterApiKey) {
    return res.status(500).json({ error: 'Specter API key is not configured on the server.' });
  }
  if (!brightdataApiKey || !brightdataDatasetId) {
    return res.status(500).json({ error: 'Bright Data API key or Dataset ID is not configured.' });
  }

  try {
    // --- STEP 1: Get Founders from Specter ---
    const peopleListUrl = `https://app.tryspecter.com/api/v1/companies/${companyId}/people?founders=true`;
    const peopleListResponse = await fetch(peopleListUrl, {
      headers: { 'X-API-Key': specterApiKey },
    });

    if (!peopleListResponse.ok) {
      throw new Error(`Specter People List API failed: ${peopleListResponse.statusText}`);
    }
    const peopleList = await peopleListResponse.json();

    if (!peopleList || peopleList.length === 0) {
      return res.status(200).json({ specterData: [], brightDataJob: null });
    }

    // --- STEP 2: Get Detailed Profiles from Specter ---
    const personDetailPromises = peopleList.map(person => {
      const personDetailUrl = `https://app.tryspecter.com/api/v1/people/${person.person_id}`;
      return fetch(personDetailUrl, { headers: { 'X-API-Key': specterApiKey } })
        .then(response => response.ok ? response.json() : null);
    });
    const successfulPeopleDetails = (await Promise.all(personDetailPromises)).filter(p => p !== null);

    // --- STEP 3: Trigger Bright Data LinkedIn Fetch ---
    const linkedInUrls = successfulPeopleDetails
      .map(person => person.linkedin_url)
      .filter(Boolean); // Filter out any null/undefined URLs

    let brightDataResponse = null;
    if (linkedInUrls.length > 0) {
      const brightDataPayload = linkedInUrls.map(url => ({ url }));

      const brightDataTriggerResponse = await fetch(`https://api.brightdata.com/datasets/v3/trigger?dataset_id=${brightdataDatasetId}&include_errors=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${brightdataApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(brightDataPayload),
      });

      if (!brightDataTriggerResponse.ok) {
        const errorText = await brightDataTriggerResponse.text();
        console.error("Bright Data API Error:", errorText);
        // Don't fail the whole request, just note the error
        brightDataResponse = { status: 'error', message: 'Failed to trigger Bright Data job.' };
      } else {
        const triggerResult = await brightDataTriggerResponse.json();
        brightDataResponse = {
          status: 'triggered',
          delivery_id: triggerResult.delivery_id,
          message: `Successfully triggered LinkedIn data fetch for ${linkedInUrls.length} founder(s). Delivery ID: ${triggerResult.delivery_id}. Data will be available in your Bright Data dataset shortly.`
        };
      }
    }

    // --- STEP 4: Return Combined Data ---
    return res.status(200).json({
      specterData: successfulPeopleDetails,
      brightDataJob: brightDataResponse
    });

  } catch (error) {
    console.error(`Server-side orchestration for people failed: ${error.message}`);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};