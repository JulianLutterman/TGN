// File: /api/people.js

module.exports = async (req, res) => {
    const { companyId } = req.query;

    if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
    }

    const specterApiKey = process.env.SPECTER_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!specterApiKey || !openaiApiKey) {
        const missingKeys = [!specterApiKey && "SPECTER_API_KEY", !openaiApiKey && "OPENAI_API_KEY"].filter(Boolean).join(', ');
        console.error(`CRITICAL: Missing environment variable(s): ${missingKeys}`);
        return res.status(500).json({ error: 'API key(s) are not configured on the server.' });
    }

    try {
        // STEP 1: Get the list of person IDs for the company (same as before)
        const peopleListUrl = `https://app.tryspecter.com/api/v1/companies/${companyId}/people`;
        const peopleListResponse = await fetch(peopleListUrl, {
            headers: { 'X-API-Key': specterApiKey },
        });

        if (!peopleListResponse.ok) {
            const errorData = await peopleListResponse.json();
            console.error("Specter People List API returned an error:", errorData);
            return res.status(peopleListResponse.status).json(errorData);
        }

        const peopleList = await peopleListResponse.json();

        if (!peopleList || peopleList.length === 0) {
            return res.status(200).json([]); // No people found, return empty array
        }

        // STEP 2: For each person, fetch their detailed profile in parallel (same as before)
        const personDetailPromises = peopleList.map(person => {
            const personDetailUrl = `https://app.tryspecter.com/api/v1/people/${person.person_id}`;
            return fetch(personDetailUrl, {
                headers: { 'X-API-Key': specterApiKey },
            }).then(response => response.ok ? response.json() : null);
        });

        const detailedPeople = await Promise.all(personDetailPromises);
        const successfulPeopleDetails = detailedPeople.filter(p => p !== null);

        // If there are 3 or fewer people, no need to ask the LLM. Just return them.
        if (successfulPeopleDetails.length <= 3) {
            return res.status(200).json(successfulPeopleDetails);
        }

        // --- NEW LOGIC STARTS HERE ---

        // STEP 3: Prepare the data for the OpenAI LLM call
        const peopleForLlm = successfulPeopleDetails.map(person => ({
            "Name": person.full_name,
            "Title/Role": person.current_position_title,
            "Linkedin Link": person.linkedin_url
        }));

        const systemPrompt = `As input you will receive a JSON that contains employees of a company. Each employee will have the following attributes:
- Name
- Title/Role
- Linkedin Link

I want you to go over this list of employees and pick which three are the most senior. CEO and CTO are most important, followed by COO, CMO, etc. After you picked these three, you will output the exact same JSON, but only the top 3 members of the team. exclude the rest. Your output must be a valid JSON array.`;

        // STEP 4: Make the API call to OpenAI using fetch (no npm library needed)
        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                // Note: "gpt-4-turbo" is the current recommended model alias for the latest GPT-4 Turbo.
                // "gpt-4.1" isn't an official model name, so we use the correct one.
                model: 'gpt-4.1',
                temperature: 0.2,
                response_format: { "type": "json_object" }, // Enables structured JSON output
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: JSON.stringify(peopleForLlm)
                    }
                ]
            })
        });

        if (!openAIResponse.ok) {
            const errorData = await openAIResponse.json();
            console.error("OpenAI API returned an error:", errorData);
            // Fallback: If OpenAI fails, return the full list so the user still sees something.
            return res.status(200).json(successfulPeopleDetails);
        }

        const openAIResult = await openAIResponse.json();
        
        // STEP 5: Parse the LLM's response
        let topPeopleFromLlm;
        try {
            // The response from the LLM is a string that needs to be parsed into a JSON object.
            // The actual content is nested inside the response object.
            const contentString = openAIResult.choices[0].message.content;
            // The prompt asks for a JSON array, but the `json_object` mode wraps it in an object.
            // We need to find the array within the parsed object.
            const parsedContent = JSON.parse(contentString);
            // Let's find the key that holds the array. It's often the first key.
            const arrayKey = Object.keys(parsedContent)[0];
            topPeopleFromLlm = parsedContent[arrayKey];

            if (!Array.isArray(topPeopleFromLlm)) {
                 throw new Error("LLM did not return a valid array.");
            }

        } catch (parseError) {
            console.error("Could not parse JSON response from OpenAI:", parseError);
            console.error("Raw content from OpenAI:", openAIResult.choices[0].message.content);
            // Fallback: Return the full list on parsing error.
            return res.status(200).json(successfulPeopleDetails);
        }

        // STEP 6: Map the filtered list from the LLM back to the original full data objects
        // We use the LinkedIn link as a unique identifier to find the original person object.
        const originalPeopleMap = new Map(
            successfulPeopleDetails.map(p => [p.linkedin_url, p])
        );

        const finalTopPeople = topPeopleFromLlm
            .map(llmPerson => originalPeopleMap.get(llmPerson['Linkedin Link']))
            .filter(p => p !== undefined); // Filter out any potential mismatches

        return res.status(200).json(finalTopPeople);

    } catch (error) {
        console.error(`Server-side orchestration for people failed: ${error.message}`);
        return res.status(500).json({ error: `Server error: ${error.message}` });
    }
};