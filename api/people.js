// File: /api/people.js

module.exports = async (req, res) => {
  // Use 'companyId' to be consistent with the frontend request
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  const apiKey = process.env.SPECTER_API_KEY;

  if (!apiKey) {
    console.error("CRITICAL: SPECTER_API_KEY environment variable not found on the server!");
    return res.status(500).json({ error: 'API key is not configured on the server.' });
  }

  // This is the new endpoint for fetching people associated with a company
  const apiUrl = `https://app.tryspecter.com/api/v1/companies/${companyId}/people`;

  try {
    const peopleResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    const data = await peopleResponse.json();

    if (!peopleResponse.ok) {
      console.error("Specter People API returned an error:", data);
      return res.status(peopleResponse.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error(`Server-side fetch for people failed: ${error.message}`);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};