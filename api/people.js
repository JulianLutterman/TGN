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
    // STEP 1: Get the list of founder IDs for the company using the `founders=true` filter.
    const peopleListUrl = `https://app.tryspecter.com/api/v1/companies/${companyId}/people?founders=true`;
    
    const peopleListResponse = await fetch(peopleListUrl, {
      headers: { 'X-API-Key': apiKey },
    });

    if (!peopleListResponse.ok) {
      const errorData = await peopleListResponse.json();
      console.error("Specter People List API returned an error:", errorData);
      return res.status(peopleListResponse.status).json(errorData);
    }

    const founderList = await peopleListResponse.json();

    if (!founderList || founderList.length === 0) {
      // No founders found for this company.
      return res.status(200).json([]); 
    }

    // STEP 2: For each founder, fetch their detailed profile in parallel.
    // This is where we get the rich LinkedIn data.
    const personDetailPromises = founderList.map(person => {
      const personDetailUrl = `https://app.tryspecter.com/api/v1/people/${person.person_id}`;
      return fetch(personDetailUrl, {
        headers: { 'X-API-Key': apiKey },
      }).then(response => {
        // If a single person fetch fails, return null so Promise.all doesn't fail.
        if (!response.ok) return null;
        return response.json();
      });
    });

    // Wait for all the detailed profile fetches to complete.
    const detailedPeople = await Promise.all(personDetailPromises);

    // Filter out any null results from failed individual fetches.
    const successfulPeopleDetails = detailedPeople.filter(p => p !== null);

    // Return the array of detailed founder profiles.
    return res.status(200).json(successfulPeopleDetails);

  } catch (error) {
    console.error(`Server-side orchestration for people failed: ${error.message}`);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};