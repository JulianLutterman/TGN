// File: /api/person-details.js

module.exports = async (req, res) => {
  const { personId } = req.query;

  if (!personId) {
    return res.status(400).json({ error: 'Person ID is required' });
  }

  const apiKey = process.env.SPECTER_API_KEY;

  if (!apiKey) {
    console.error("CRITICAL: SPECTER_API_KEY environment variable not found on the server!");
    return res.status(500).json({ error: 'API key is not configured on the server.' });
  }

  // IMPORTANT: The documentation for this endpoint was not provided.
  // This URL is a logical guess based on standard REST API design.
  // PLEASE VERIFY THIS IS THE CORRECT ENDPOINT from your Specter API docs.
  // It might be /people/{personId} or /v1/people/{personId}, etc.
  const apiUrl = `https://app.tryspecter.com/api/v1/people/${personId}`;

  try {
    const personResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    const data = await personResponse.json();

    if (!personResponse.ok) {
      console.error(`Specter Person Details API returned an error for ID ${personId}:`, data);
      return res.status(personResponse.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error(`Server-side fetch for person details failed: ${error.message}`);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};