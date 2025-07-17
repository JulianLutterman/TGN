// File: /api/specter.js

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  const apiKey = "2582b8f9ce49d89793f40f4e5abcd303f94e9a16c9cd47f87919a603d29e2603";

  if (!apiKey) {
    console.error("CRITICAL: SPECTER_API_KEY environment variable not found on the server!");
    return res.status(500).json({ error: 'API key is not configured on the server. Please contact the site administrator.' });
  }

  const apiUrl = `https://api.tryspecter.com/companies/${id}`;

  try {
    const specterResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    // Check if the response from Specter is JSON before trying to parse it.
    const contentType = specterResponse.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      // It's JSON, proceed as normal.
      const data = await specterResponse.json();
      if (!specterResponse.ok) {
        // The JSON contains an error message from Specter
        console.error("Specter API returned a JSON error:", data);
        return res.status(specterResponse.status).json(data);
      }
      return res.status(200).json(data);
    } else {
      // It's NOT JSON. It's probably the HTML error page.
      // Let's log it to find out what it is.
      const responseText = await specterResponse.text();
      console.error("CRITICAL: Specter API did not return JSON. It returned this text/HTML instead:");
      console.error(responseText); // This will show the HTML in your Vercel logs!
      
      // Send a generic error to the frontend.
      return res.status(502).json({ error: 'Bad Gateway: Received an invalid response from the Specter API.' });
    }

  } catch (error) {
    console.error(`Server-side fetch function failed: ${error.message}`);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};