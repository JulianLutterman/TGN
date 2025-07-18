// File: /api/specter.js

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  const apiKey = process.env.SPECTER_API_KEY;

  if (!apiKey) {
    console.error("CRITICAL: SPECTER_API_KEY environment variable not found on the server!");
    return res.status(500).json({ error: 'API key is not configured on the server. Please contact the site administrator.' });
  }

  const apiUrl = `https://app.tryspecter.com/api/v1/companies/${id}`;

  try {
    const specterResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    const contentType = specterResponse.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await specterResponse.json();
      if (!specterResponse.ok) {
        console.error("Specter API returned a JSON error:", data);
        return res.status(specterResponse.status).json(data);
      }
      return res.status(200).json(data);
    } else {
      const responseText = await specterResponse.text();
      console.error("CRITICAL: Specter API did not return JSON. It returned this text/HTML instead:");
      console.error(responseText);
      return res.status(502).json({ error: 'Bad Gateway: Received an invalid response from the Specter API.' });
    }

  } catch (error) {
    console.error(`Server-side fetch function failed: ${error.message}`);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};