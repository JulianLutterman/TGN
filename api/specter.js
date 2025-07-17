// File: /api/specter.js
// Using CommonJS syntax (module.exports) for better compatibility.

module.exports = async (req, res) => {
  // Get the companyId from the query parameter (e.g., /api/specter?id=12345)
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  // Get the API key securely from Vercel Environment Variables
  const apiKey = process.env.SPECTER_API_KEY;

  if (!apiKey) {
    // This is a critical server-side error.
    console.error("SPECTER_API_KEY environment variable not set!");
    return res.status(500).json({ error: 'API key is not configured on the server' });
  }

  const apiUrl = `https://api.tryspecter.com/companies/${id}`;

  try {
    const specterResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json' // Good practice to specify expected response type
      },
    });

    // Check if the response from Specter is not OK
    if (!specterResponse.ok) {
      const errorText = await specterResponse.text();
      console.error(`Specter API Error (Status: ${specterResponse.status}): ${errorText}`);
      return res.status(specterResponse.status).json({ error: `Specter API Error: ${errorText}` });
    }

    const data = await specterResponse.json();
    
    // Send the data from Specter back to your frontend
    return res.status(200).json(data);

  } catch (error) {
    console.error(`Server-side fetch error: ${error.message}`);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};