// File: /api/people.js

// File: /api/people.js (DEBUG VERSION)

module.exports = async (req, res) => {
  const { companyId } = req.query;

  console.log(`DEBUG [Server /api/people]: Function invoked for companyId: ${companyId}`);

  if (!companyId) {
    console.error("DEBUG [Server /api/people]: Failed because companyId is missing.");
    return res.status(400).json({ error: 'Company ID is required' });
  }

  const apiKey = process.env.SPECTER_API_KEY;

  if (!apiKey) {
    console.error("CRITICAL: SPECTER_API_KEY environment variable not found on the server!");
    return res.status(500).json({ error: 'API key is not configured on the server.' });
  }

  try {
    // STEP 1: Get the list of person IDs for the company
    const peopleListUrl = `https://app.tryspecter.com/api/v1/companies/${companyId}/people?founders=true`;
    console.log(`DEBUG [Server /api/people]: Fetching from Specter URL: ${peopleListUrl}`);

    const peopleListResponse = await fetch(peopleListUrl, {
      headers: { 'X-API-Key': apiKey },
    });

    console.log(`DEBUG [Server /api/people]: Received status ${peopleListResponse.status} from Specter.`);

    // We need to see the raw text in case it's not JSON
    const responseText = await peopleListResponse.text();
    console.log(`DEBUG [Server /api/people]: Raw response text from Specter: ${responseText}`);

    if (!peopleListResponse.ok) {
      console.error(`DEBUG [Server /api/people]: Specter API returned an error. Body: ${responseText}`);
      // Try to parse as JSON, but fallback to text if it fails
      try {
        return res.status(peopleListResponse.status).json(JSON.parse(responseText));
      } catch (e) {
        return res.status(peopleListResponse.status).json({ error: responseText });
      }
    }

    const peopleList = JSON.parse(responseText);
    console.log(`DEBUG [Server /api/people]: Parsed founder list from Specter:`, peopleList);

    if (!peopleList || peopleList.length === 0) {
      console.log("DEBUG [Server /api/people]: No founders found in Specter's response. Returning empty array.");
      return res.status(200).json([]); // No people found, return empty array
    }

    // --- TEMPORARY SIMPLIFICATION ---
    // For debugging, we will SKIP the detailed profile fetch and return the initial list directly.
    // This helps us confirm if the first API call is working correctly.
    // The objects in this list have `person_id`, `full_name`, `title`, etc.
    // This is NOT the final data structure, but it's enough to debug.
    console.log("DEBUG [Server /api/people]: SIMPLIFICATION: Returning the initial list without fetching details.");
    return res.status(200).json(peopleList);

    /*
    // --- The original detailed fetch logic is commented out for now ---
    const personDetailPromises = peopleList.map(person => {
      // ... logic to fetch each person's details ...
    });
    const detailedPeople = await Promise.all(personDetailPromises);
    const successfulPeopleDetails = detailedPeople.filter(p => p !== null);
    return res.status(200).json(successfulPeopleDetails);
    */

  } catch (error) {
    console.error(`DEBUG [Server /api/people]: A critical error occurred in the try-catch block: ${error.message}`);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};