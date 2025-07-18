// File: /api/people.js (Restored to full functionality with detailed logging)

module.exports = async (req, res) => {
  const { companyId } = req.query;
  console.log(`DEBUG [Server /api/people]: Function invoked for companyId: ${companyId}`);

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  const apiKey = process.env.SPECTER_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: SPECTER_API_KEY environment variable not found!");
    return res.status(500).json({ error: 'API key is not configured on the server.' });
  }

  try {
    // STEP 1: Get the list of founder IDs
    const peopleListUrl = `https://app.tryspecter.com/api/v1/companies/${companyId}/people?founders=true`;
    console.log(`DEBUG [Server /api/people]: Fetching founder list from: ${peopleListUrl}`);
    const peopleListResponse = await fetch(peopleListUrl, {
      headers: { 'X-API-Key': apiKey },
    });

    if (!peopleListResponse.ok) {
      const errorText = await peopleListResponse.text();
      console.error(`DEBUG [Server /api/people]: Specter founder list API returned an error. Status: ${peopleListResponse.status}, Body: ${errorText}`);
      return res.status(peopleListResponse.status).json({ error: `Failed to get founder list: ${errorText}` });
    }

    const peopleList = await peopleListResponse.json();
    console.log(`DEBUG [Server /api/people]: Got founder list:`, peopleList);

    if (!peopleList || peopleList.length === 0) {
      console.log("DEBUG [Server /api/people]: No founders found. Returning empty array.");
      return res.status(200).json([]);
    }

    // STEP 2: For each founder, fetch their detailed profile in parallel
    console.log(`DEBUG [Server /api/people]: Now fetching detailed profiles for ${peopleList.length} founders.`);
    
    const personDetailPromises = peopleList.map(person => {
      const personDetailUrl = `https://app.tryspecter.com/api/v1/people/${person.person_id}`;
      console.log(`DEBUG [Server /api/people]:   - Preparing to fetch from ${personDetailUrl}`);
      
      return fetch(personDetailUrl, {
        headers: { 'X-API-Key': apiKey },
      }).then(async response => {
        if (!response.ok) {
          console.error(`DEBUG [Server /api/people]:   - FAILED to fetch details for ${person.person_id}. Status: ${response.status}`);
          return null; // Return null for failed requests
        }
        const detailedPerson = await response.json();
        console.log(`DEBUG [Server /api/people]:   - SUCCESS fetching details for ${person.person_id}. Name: ${detailedPerson.full_name}`);
        return detailedPerson;
      }).catch(error => {
          console.error(`DEBUG [Server /api/people]:   - CRITICAL ERROR fetching details for ${person.person_id}: ${error.message}`);
          return null; // Also return null on network errors
      });
    });

    // Wait for all the detailed profile fetches to complete
    const detailedPeople = await Promise.all(personDetailPromises);

    // Filter out any null results from failed individual fetches
    const successfulPeopleDetails = detailedPeople.filter(p => p !== null);
    console.log(`DEBUG [Server /api/people]: Successfully fetched ${successfulPeopleDetails.length} detailed profiles. Sending to client.`);
    
    // This now returns the full objects with `id` and `linkedin_url`
    return res.status(200).json(successfulPeopleDetails);

  } catch (error) {
    console.error(`DEBUG [Server /api/people]: A critical error occurred in the main try-catch block: ${error.message}`);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};