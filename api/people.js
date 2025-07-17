// File: /api/people.js

module.exports = async (req, res) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  const apiKey = process.env.SPECTER_API_KEY;

  if (!apiKey) {
    console.error("CRITICAL: SPECTER_API_KEY environment variable not found on the server!");
    return res.status(500).json({ error: 'API key is not configured on the server.' });
  }

  try {
    // STEP 1: Get the list of person IDs for the company
    // --- MODIFICATION HERE ---
    // Added '?founders=true' to the end of the URL to filter for founders only.
    const peopleListUrl = `https://app.tryspecter.com/api/v1/companies/${companyId}/people?founders=true`;
    
    const peopleListResponse = await fetch(peopleListUrl, {
      headers: { 'X-API-Key': apiKey },
    });

    if (!peopleListResponse.ok) {
      const errorData = await peopleListResponse.json();
      console.error("Specter People List API returned an error:", errorData);
      return res.status(peopleListResponse.status).json(errorData);
    }

    const peopleList = await peopleListResponse.json();

    if (!peopleList || peopleList.length === 0) {
      // This now means "No founders found"
      return res.status(200).json([]); 
    }

    // STEP 2: For each person (now just founders), fetch their detailed profile in parallel
    const personDetailPromises = peopleList.map(person => {
      const personDetailUrl = `https://app.tryspecter.com/api/v1/people/${person.person_id}`;
      return fetch(personDetailUrl, {
        headers: { 'X-API-Key': apiKey },
      }).then(response => {
        if (!response.ok) return null;
        return response.json();
      });
    });

    // Wait for all the detailed profile fetches to complete
    const detailedPeople = await Promise.all(personDetailPromises);

    // Filter out any null results from failed individual fetches
    const successfulPeopleDetails = detailedPeople.filter(p => p !== null);

    return res.status(200).json(successfulPeopleDetails);

  } catch (error) {
    console.error(`Server-side orchestration for people failed: ${error.message}`);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};