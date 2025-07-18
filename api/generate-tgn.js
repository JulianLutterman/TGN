// File: /api/generate-tgn.js

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to format the user prompt from raw data
function buildUserPrompt(initials, growthMetrics, companyData, peopleData) {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getFullYear()).slice(-2)}`;

    let prompt = `USER INITIALS: ${initials}\n`;
    prompt += `CURRENT DATE: ${formattedDate}\n\n`;

    prompt += `COMPANY DATA:\n`;
    prompt += `- Name: ${companyData.name || 'N/A'}\n`;
    prompt += `- Description: ${companyData.description || 'N/A'}\n`;
    prompt += `- Website: ${companyData.website?.url || 'N/A'}\n`;
    prompt += `- LinkedIn: ${companyData.socials?.linkedin?.url || 'N/A'}\n\n`;

    prompt += `FUNDING HISTORY:\n`;
    const fundingRounds = companyData.funding?.round_details;
    if (fundingRounds && fundingRounds.length > 0) {
        fundingRounds.forEach(round => {
            const date = round.date || 'N/A';
            const amount = round.raised ? `$${round.raised.toLocaleString()}` : 'Amount N/A';
            const investors = round.investors?.join(', ') || 'Investors N/A';
            const roundType = round.type ? ` (${round.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())})` : '';
            prompt += `- Round: ${date}${roundType}: ${amount}. Investors: ${investors}\n`;
        });
    } else {
        prompt += `- No funding history available.\n`;
    }
    prompt += `\n`;

    prompt += `FOUNDER PROFILES:\n`;
    if (peopleData && peopleData.length > 0) {
        peopleData.forEach((person, index) => {
            prompt += `--- Founder ${index + 1} ---\n`;
            prompt += `Name: ${person.full_name || 'N/A'}\n`;
            prompt += `LinkedIn: ${person.linkedin_url || 'N/A'}\n`;

            prompt += `Experience:\n`;
            if (person.experience && person.experience.length > 0) {
                person.experience.forEach(exp => {
                    const startDate = exp.start_date ? new Date(exp.start_date).toLocaleDateString('en-GB') : 'N/A';
                    const endDate = exp.is_current ? 'Present' : (exp.end_date ? new Date(exp.end_date).toLocaleDateString('en-GB') : 'N/A');
                    prompt += `  - ${exp.title || 'N/A'} at ${exp.company_name || 'N/A'} (${startDate} - ${endDate})\n`;
                    if (exp.description) {
                        prompt += `    Description: ${exp.description.trim().replace(/\n/g, ' ')}\n`;
                    }
                });
            } else {
                prompt += `  - No work experience available.\n`;
            }

            prompt += `Education:\n`;
            if (person.education && person.education.length > 0) {
                person.education.forEach(edu => {
                    const startDate = edu.start_date ? new Date(edu.start_date).getFullYear() : 'N/A';
                    const endDate = edu.end_date ? new Date(edu.end_date).getFullYear() : 'N/A';
                    prompt += `  - ${edu.degree_title || 'Degree N/A'} at ${edu.name || 'N/A'} (${startDate} - ${endDate})\n`;
                });
            } else {
                prompt += `  - No education history available.\n`;
            }
            prompt += `\n`;
        });
    } else {
        prompt += `- No founder information available.\n\n`;
    }

    prompt += `USER-PROVIDED GROWTH METRICS:\n`;
    prompt += `${growthMetrics || 'No specific growth metrics provided.'}\n`;

    return prompt;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!process.env.OPENAI_API_KEY) {
        console.error("CRITICAL: OPENAI_API_KEY environment variable not found!");
        return res.status(500).json({ error: 'AI service is not configured on the server.' });
    }

    try {
        const { initials, growthMetrics, companyData, peopleData } = req.body;

        if (!initials || !companyData || !peopleData) {
            return res.status(400).json({ error: 'Missing required data for generation.' });
        }

        const systemPrompt = `For each Letter in TGN, you should give a score from 0-1. Your total TGN score should be the sum of the three T, G, and N scores. Please find the criteria on how to assign scores below:

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

T 0.5: CEO (Noah W) took prev. startup to $1M ARR (BlingBerry) and has 10 years of tech sales experience

G 0.5: Forecasting $100k+ ARR in next two months

N 1: Steve's friend


Everything has to be in that specific format exactly, with the T first, then the score, and then the ":" and then the note with name, role and then what he did previously, for every founder.



### 3 EXAMPLES

[LS] 31/01/25 TGN 1.25

SaaS; CometClips is a trackable interactive personalized video platform which enables organizations to target audiences with mobile marketing, communication and micro-learning video campaigns.

T 0.25: Gregoy Conellan, founded a RE finance company before started career in banking

G 0: launched in 2009 as consulting service, then went into SaaS, 2024 new poc for new product, seem to have global clients such as Johnson and Johnson, Nivea, Budweiser

N 1: NJM via Mark Gemmill, personal contact





[OA] 08/04/2024 TGN 2

SaaS FinOps; Unused SaaS licenses are a $75B problem. Priviom is developing a cost-optimization platform that shows IT + Finance leaders the right costs to cut.

Plan to monetize from both vendors and buyers by proving a comprehensive tech stack analysis for buyers and selling buyer data to vendors.

T 0.5: CEO (Noah W) took prev. startup to $1M ARR (BlingBerry) and has 10 years of tech sales experience

G 0.5: Forecasting $100k+ ARR in next two months

N 1: Steve's friend




[RM] 30/01/25 TGN 1.5

Direct inbound to SJS from founder.

SaaS; AI-driven home design (real estate home configurator & rendering engine), lowering costs and speed while increasing customization ability. "Figma for home design".

T 0.75 Caleb Barclay CEO (Prev. Senior Product Designer at Coinbase 1y1m, Senior Product Designer at Figma 1y, Senior Product Designer at Godaddy 1y3m), Daniel Nguyen (Prev. SWE at Monograph - project management SaaS 5y5m)

G 0.5 $217k ARR (19% MoM growth). 27 paying customers with $8k ACV and $350 CAC. Pipeline is worth $9m ARR.

N 0.25 Raised $1m pre-seed from US angels.`;

        const userPrompt = buildUserPrompt(initials, growthMetrics, companyData, peopleData);

        const completion = await openai.chat.completions.create({
            model: "o4-mini",
            temperature: 0.1,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
        });

        const tgnNote = completion.choices[0].message.content;

        res.status(200).json({ tgnNote });

    } catch (error) {
        console.error('Error in /api/generate-tgn:', error);
        const errorMessage = error.response ? error.response.data.error.message : error.message;
        res.status(500).json({ error: `Server error during AI generation: ${errorMessage}` });
    }
};