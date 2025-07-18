// File: /api/generate-tgn.js

// Helper function to format date for the prompt
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        // Handles both 'YYYY-MM-DD' and full ISO strings
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    } catch (e) {
        return dateString; // Return original if it's not a valid date
    }
}

// Helper function to build the user prompt string
function buildUserPrompt(initials, growthMetrics, companyData, founderData) {
    let prompt = `### CONTEXT\n`;
    prompt += `- User Initials: ${initials}\n`;
    prompt += `- Generation Date: ${new Date().toLocaleDateString('en-GB')}\n\n`; // DD/MM/YYYY format

    prompt += `### COMPANY DATA\n`;
    prompt += `- Name: ${companyData.name || 'N/A'}\n`;
    prompt += `- Description: ${companyData.description || 'N/A'}\n`;
    prompt += `- Website: ${companyData.website?.url || 'N/A'}\n`;
    prompt += `- LinkedIn: ${companyData.socials?.linkedin?.url || 'N/A'}\n\n`;

    if (growthMetrics) {
        prompt += `### GROWTH METRICS (User Input)\n`;
        prompt += `${growthMetrics}\n\n`;
    } else {
        prompt += `### GROWTH METRICS (User Input)\n`;
        prompt += `No specific growth metrics provided.\n\n`;
    }

    prompt += `### FUNDING HISTORY\n`;
    const fundingRounds = companyData.funding?.round_details;
    if (fundingRounds && fundingRounds.length > 0) {
        fundingRounds.forEach(round => {
            const date = round.date || 'N/A';
            const amount = round.raised ? `$${round.raised.toLocaleString()}` : 'Amount N/A';
            const investors = round.investors?.join(', ') || 'Investors N/A';
            const roundType = round.type ? round.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';
            prompt += `- ${date} (${roundType}): ${amount}. Investors: ${investors}\n`;
        });
    } else {
        prompt += `No funding history available.\n`;
    }
    prompt += `\n`;

    prompt += `### FOUNDER PROFILES\n`;
    if (founderData && founderData.length > 0) {
        founderData.forEach((person, index) => {
            prompt += `---\n`;
            prompt += `#### Founder ${index + 1}: ${person.full_name || 'N/A'}\n`;
            prompt += `- LinkedIn: ${person.linkedin_url || 'N/A'}\n\n`;
            prompt += `**Work Experience:**\n`;
            if (person.experience && person.experience.length > 0) {
                person.experience.forEach(exp => {
                    const startDate = formatDate(exp.start_date);
                    const endDate = exp.is_current ? 'Present' : formatDate(exp.end_date);
                    prompt += `- ${exp.title || 'N/A'} at ${exp.company_name || 'N/A'} (${startDate} - ${endDate})\n`;
                });
            } else {
                prompt += `No work experience available.\n`;
            }

            prompt += `\n**Education:**\n`;
            if (person.education && person.education.length > 0) {
                person.education.forEach(edu => {
                    const startDate = formatDate(edu.start_date);
                    const endDate = formatDate(edu.end_date);
                    prompt += `- ${edu.degree_title || 'Degree N/A'} at ${edu.name || 'School N/A'} (${startDate} - ${endDate})\n`;
                });
            } else {
                prompt += `No education history available.\n`;
            }
            prompt += `\n`;
        });
    } else {
        prompt += `No founder information available.\n`;
    }

    return prompt;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const openAIApiKey = process.env.OPENAI_API_KEY;
    if (!openAIApiKey) {
        console.error("CRITICAL: OPENAI_API_KEY environment variable not found!");
        return res.status(500).json({ error: 'Server configuration error: Missing OpenAI API key.' });
    }

    try {
        const { initials, growthMetrics, companyData, founderData } = req.body;

        if (!initials || !companyData || !founderData) {
            return res.status(400).json({ error: 'Missing required data: initials, companyData, or founderData.' });
        }

        const systemPrompt = `### WHO ARE YOU
You are a Venture Capital Analyst writing a first initial screening note (internally called TGN Note) on a startup.

### INPUT
You will be given a summary of a specific company, this summary includes the company name, a description of the product, its founders, their work experience and education, detail on the company's previous investment rounds, and in some cases details on the company's financial growth trajectory so far.
You will also receive the current data and the user's initials

### TASK
You will output a TGN Note, this stands for Team Growth Network. Team stands for how good the founders are on paper, Growth stands for how strong their growth has been so far, and Network stands for who has invested in them in the past.
This note is just for initial screening and should be concise.
For each Letter in TGN, you should give a score from 0-1. Your total TGN score should be the sum of the three T, G, and N scores. Please find the criteria on how to assign scores below:

### SCORING CRITERIA
**TGN Criteria**

This serves as guidance only and none of them are hard-coded, always use your gut feeling if you think something should be rated stronger than what the outcome was below.

**Team:**

- **1:** Founders that have founded and exited a company for >$100m before
- **0.75:** Founders that have founded and exited before but no big success + Early employees of Unicorns now founding companies on their own + VPs of large Tech companies + Engagement Managers and up from McK and BCG
- **0.5:** Industry specific: e.g. FinTech ex-employees of BB banks, employees of relatively successful startups in adjacent spaces
- **0:** everything else

**Growth:** Often we do not have financial figures in initial touchpoint so I am also sometimes taking anything else online available such as App downloads, website clicks, LinkedIn Headcount growth etc). Furthermore it is really depending on the stage and profitability. A company growing 1.8x YoY from $10m ARR to $18m ARR should in my view still get (close to) 1 – especially if bootstrapped / not burning – not 0. But growing 1.8x YoY from $20k ARR to $36k indeed a 0

- **1:** More than 5x Top-line growth YoY or more than 2.5x if annualized revenue is larger than €10m
- **0.75**: More than 3.5x Top-line growth YoY
- **0.5**: More than 2x Top-line growth YoY
- **0:** below 2x top-line growth YoY

**Network:**

- **1:** AAA seed funds and top-tier angels
    - *Example of Funds at Seed stage*: Point9, Picus, Cherry, Cavalry, Atlantic Labs, Speedinvest, Seedcamp, Btov, Visionaries Club, La Famiglia, 468 Capital, 10x Group, Firstminute
    - *Example of Series A+ Funds* (that also do Seed sometimes): HV Capital, Earlybird, Balderton, Creandum, Northzone, EQT Ventures, Any American fund, Project A, Target Global,
    - *German Tier 1 Angels*: Jens Lapinski (Angelinvest), Philip Moehring (Seedcamp/Angellist), Christophe Maire (Atlantic Labs), Felix Jahn (McMakler, Home24), Felix Haas (IDnow), Lukasz Gadowski (Delivery Hero), Heiko Hubertz (Bigpoint), Johannes Reck (GYourGuide), Valentin Stalf (N26), Maximilian Tayenthal (N26),
    - *French Tier 1 Angels*: Pierre Kosciusko Morizet, Alexis Bonillo, Antoine Martin, Florian Douetteau
    - *Other Tier 1 Angels*: Oskar Hartmann (Moscow)
- **0.75**: Top 10 advisors in Europe (would be great to get some context on this) + DN portfolio companies + tier 2 seed funds
    - *Top 10 Advisors:* GP Bullhound, GCA Altium etc.
    - *Example of Funds in DACH*: HTGF, UVC, Fly Ventures, Check24, Truventuro, Coparion, Redalpine, Paua, Acton, Capnamic
    - *Plus:* People directly connected to DN or friendly relationships + intros made to Partners from Friends and befriended Funds
- **0.5:** Tier 2 angels and advisers
    - *German Tier 2 Angels:* Nils Regge (Apollo Health Ventures), Wolfgang Heigl (Home to Go), Markus Fuhrmann (Cavalry), Marco Vietor (audibene), Nils Regge (TruVenturo) , Konstantin Sixt (Sixt), Thilo Hardt (Mr. Spex), Gunnar Graef, Joerg Rheinboldt (APX), Axel Menneking (Telekom hub:raum), Thomas Hessler (GTECH), Christian Gaiser (numa), Julian Teicke (WeFox), Michael John (WeFox), Michael Stephan (Raisin), Frank Freudn (Raisin), Philipp Magin (Quandoo)
    - *French Tier 2 Angels*: Mickael Benabou, Marc Ménasé, Renaud Visage, Eduardo Ronzano, Cyril Vermeulen
    - *Other Tier 2 Angels* : Charles-Hubert Le Baron (London)
- **0:** Anybody else.



### FORMAT
You should format your Note in a very specific way, starting with the user's initials in brackets and the current date, e.g.: [LS] 31/01/25
Following that, you will output the total TGN Score, e.g.: TGN 1.25
Following that, you will put a very brief summary of the company's product, e.g.: AI-driven home design (real estate home configurator & rendering engine), lowering costs and speed while increasing customization ability. "Figma for home design".
Then, you will output the T, G, and N notes, like this:

T 1 Anton Juric COO (Prev. Co-Founder & CEO at Sectragon - Acquired by TCECUR for $5m 8y2m), Gustav Hammarlund CPO (Prev. VP at Goldman Sachs 8y3m, Trading Application Analyst at Pantor Engineering 2y1m), Niklas Lindgren CEO (Prev. Co-Founder & CMO at Sectragon 8y1m), David Rydberg CTO (Prev. VP at Goldman Sachs 3y1m, Quantitative Analyst at SEB 1y5m)
G 0.5 No financial data, announced first launch in Netherlands with Klarna in Apr-25
N 1 Raised $5m pre-seed from Creandum Jun-25

For the Team, you should not put every single piece of experience in your notes. You should only put the ones that are most important. In any case, put max. 3 pieces of experience. Also, don't forget to include the duration of the experiences for each experience you mention.

For the Network part, the user input fund names will be lower case with hyphens instead of just a space. Reformat those names to the proper names. Also, similarly to the Team. Don't name every single investor, only the 1-5 most important ones (if any at all).

In these notes, it is very important that you only give dry FACTS, not an interpretation of those facts. Also, always give funding amount and dates in the Network part. For the growth part, you should only add content if there is content in the first place. Sometimes there will not be any info, in which case you give a score of 0 and just type "/"

Everything has to be in that specific format exactly, with the T first, then the score, and then the ":" and then the note with name, role and then what he did previously, for every founder.



### 3 EXAMPLES

[JL] 23/06/25 TGN 1.75

Short-form AI video creation tool to cheaply and quickly create ads for Reels, TikTok, and YT Shorts.

T 0.75 Patrick Haede CEO (Prev. Co-Founder at Sonic - Consultancy and MVP development for consumer and B2B products 3y1m, Head of Product at Gorillas 1y6m), Magnus Langanke (Prev. Co-founder & Engineering at Sonic 3y2m, Head of Backend at Gorillas 1y5m), Full founding team (10 members) is ex-Sonic.
G 0 No data availability
N 1 Raised $5m pre-seed from Creandum Jun-25


[JL] 30/06/25 TGN 1.75

GenAI Native CAD software

T 1 Anton Juric COO (Prev. Co-Founder & CEO at Sectragon - Acquired by TCECUR for $5m 8y2m), Gustav Hammarlund CPO (Prev. VP at Goldman Sachs 8y3m, Trading Application Analyst at Pantor Engineering 2y1m), Niklas Lindgren CEO (Prev. Co-Founder & CMO at Sectragon 8y1m), David Rydberg CTO (Prev. VP at Goldman Sachs 3y1m, Quantitative Analyst at SEB 1y5m)
G 0 /
N 0.75 Raised $3m Seed from Norrsken May-25


[JL] 23/06/25 TGN 1.5

Real-time consumer lending database for BNPL providers.

T 0.75 Alex Naughton CEO (Prev. Head of UK, Ireland, Netherlands at Klarna 3y5m), Loic Berthou (Prev. Director of Engineering at Zip Co 1y11m, Engineering Manager Fraud & Risk at Quadpay - acquired by Zip Co 2y4m)
G 0.5 No financial data, announced first launch in Netherlands with Klarna in Apr-25
N 0.25 Raised $1.8m pre-seed from Honeycomb Asset Management and Carthona Capital Mar-25


[JL] 01/07/25 TGN 2.25

Custom agent builder for customizing customer interactions. UI looks very crisp. Tried trial version and looks extremely user friendly.

T 0.75 Krijn Rijshouwer Founder (Prev. Product Designer at OpenAI 6m, Product Designer Framer 5y9m)
G 0.5 Web Visits 8x Past 3 Months
N 1 Raised $3.5m Pre-seed from Sequoia Feb-25


[JL] 15/07/25 TGN 1.25

AI for research and document analysis for legal teams

T 0.25 Raoul Bouchrit CEO (Prev. Project Lead at Port of Rotterdam 1y3m, Senior Consultant at Vasco Consult 1y5m, Consultant at Atos 10m), Nordin Bouchrit CPO (Senior Data Engineer at Valcon 2y5m, CoF at Homey.rent - failed startup 1y10m, Data Scientist at MetrixLab 1y), Andreas Lepidis CTO (Prev. Data Architect at MKB Brandstof 1y9m, Freelance Software Engineer 6y4m)
G 0.5 Logos: Dutch Ministry of Social Affairs & Employment, Several Law Offices, LI FTE 2x past year
N 0.5 Raised $2m Seed from Chris Oomen (Optiver founder) Apr-25d`;

        const userPrompt = buildUserPrompt(initials, growthMetrics, companyData, founderData);

        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAIApiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4.1', // Using the latest powerful model
                temperature: 0,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
            }),
        });

        if (!openAIResponse.ok) {
            const errorBody = await openAIResponse.json();
            console.error('OpenAI API Error:', errorBody);
            throw new Error(errorBody.error?.message || 'Failed to get a response from OpenAI.');
        }

        const data = await openAIResponse.json();
        const tgnNote = data.choices[0]?.message?.content;

        if (!tgnNote) {
            throw new Error('Received an empty response from OpenAI.');
        }

        // Send the plain text response back to the client
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(tgnNote);

    } catch (error) {
        console.error(`Server-side error in /api/generate-tgn: ${error.message}`);
        return res.status(500).json({ error: `Server error: ${error.message}` });
    }
};