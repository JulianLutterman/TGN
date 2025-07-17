// File: /api/specter.js

export default async function handler(req, res) {
  // Get the companyId from the query parameter (e.g., /api/specter?id=12345)
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  // Get the API key securely from Vercel Environment Variables
  const apiKey = process.env.SPECTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key is not configured on the server' });
  }

  const apiUrl = `https://api.tryspecter.com/companies/${id}`;

  try {
    const specterResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!specterResponse.ok) {
      // Forward the error from the Specter API
      const errorText = await specterResponse.text();
      return res.status(specterResponse.status).json({ error: `Specter API Error: ${errorText}` });
    }

    const data = await specterResponse.json();

    // IMPORTANT: Set CORS headers on YOUR response to allow your frontend to access it
    res.setHeader('Access-Control-Allow-Origin', '*'); // Or be more specific: 'https://tgn-three.vercel.app'
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    // Send the data from Specter back to your frontend
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}