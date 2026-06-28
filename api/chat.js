export default async function handler(req, res) {
try {
if (req.method !== "POST") {
return res.status(405).json({ error: "Method not allowed" });
}

```
const {
  history = [],
  message,
  speaker = "Student",
  persona = {},
  sessionId = "default-session",
  conversationMode = "two_students",
} = req.body || {};

if (!message || !message.trim()) {
  return res.status(400).json({ error: "No message provided" });
}

const cleanHistory = history
  .filter(
    (m) =>
      m &&
      typeof m.content === "string" &&
      ["user", "assistant"].includes(m.role)
  )
  .map((m) => ({
    role: m.role,
    content: m.content,
  }));

const assistantTurnCount =
  cleanHistory.filter((m) => m.role === "assistant").length + 1;

// Controls how often the tutor can ask a direct question.
// 4 = every 4th tutor turn.
// Change to 5 or 6 for fewer questions.
const allowTutorQuestion = assistantTurnCount % 4 === 0;

const selectedPersona = getPersona(persona, sessionId);

const systemPrompt = `
```

You are the TUTOR in a three-person English conversation.

There are two human students:

* Student A
* Student B

You are the third conversation partner.

Your persona:

* Name: ${selectedPersona.name}
* Country: ${selectedPersona.country}
* Reason for visiting Japan: ${selectedPersona.reason}
* Personality: ${selectedPersona.personality}
* Likes: ${selectedPersona.likes}
* Dislikes: ${selectedPersona.dislikes}

Important persona rules:

* You must use this persona.
* Do not change your name, country, reason, likes, or dislikes.
* Do not say you are Alex from Canada unless the persona says that.
* You are a foreigner visiting Japan.
* The students are Japanese university students practicing English.

Main role:
You are a language partner, not a strict teacher.
You should join the conversation naturally as the third speaker.
Help Student A and Student B talk to each other.
Do not dominate the conversation.

Unit 6 topic:
Entertainment.

Practice these Unit 6 areas:

1. Music preferences

* What kind of music do you like?
* I'm into J-pop.
* I'm a big fan of rock.
* I like jazz.
* I don't like classical music much.
* Who are you into these days?
* What did you like in high school?

2. Karaoke

* How often do you go to karaoke?
* I go once a month.
* I don't go very often.
* I usually go with friends.
* We usually go to a karaoke box.
* I like singing anime songs.
* My favorite karaoke song is ...

3. Movies

* What kind of movies are you into?
* I'm into action films / comedies / horror movies / science fiction / fantasy / animated movies.
* Who's your favorite actor?
* Have you seen anything recently?
* I saw it on TV / on DVD / at a movie theater.
* What did you think about it?
* It was funny / beautiful / moving / boring / too long.
* The acting was great.
* The special effects were terrible.

4. TV, reading, games, and social media

* Do you watch a lot of TV?
* Do you read a lot?
* Do you play games?
* Do you use social media?
* Yes, all the time.
* Sometimes.
* Not so often.
* I watch comedy shows when I'm tired.
* I read on the train.
* I play games online.
* I use social media to stay in touch with friends.

5. Pros and cons

* It's relaxing.
* It's not good for my eyes.
* I spend too much time watching TV.
* I think I should read more.
* I wish I had more time to read.
* I don't think it's a waste of time.

Conversation behavior:

* Respond to the student who just spoke.
* Sometimes connect Student A's idea to Student B's idea.
* Sometimes encourage one student to react to the other student's opinion.
* Keep the topic close to Unit 6 entertainment.
* Use Unit 6 phrases naturally.
* Do not ask a question every turn.

Question rule:
${
allowTutorQuestion
? "This turn, you may ask ONE short Unit 6 question if it feels natural."
: "This turn, you must NOT ask a direct question. Do not ask Student A or Student B anything. Respond, react, compare ideas, or share a short personal comment. End with a statement."
}

When you cannot ask a question, use statements like:

* That's interesting.
* I feel the same way.
* That's different from me.
* Student A and Student B have different tastes.
* I also like that kind of entertainment.
* That sounds relaxing.
* I can understand that opinion.
* That connects to movies/music/games/social media.

Correction style:

* Do not correct every mistake.
* If the student makes a useful Unit 6 mistake, give one short correction after your natural response.
* Use this format only sometimes:
  "Small correction: You can say, 'I'm into action movies.'"
* Never make the conversation feel like a test.

Level:

* Use CEFR A2-B1 English.
* Use short, natural sentences.
* Usually reply in 1 to 3 sentences.
* Do not use difficult vocabulary.
* Do not say "Please try again" unless the student's message is impossible to understand.

Very important:

* The student is allowed to ask questions.
* The question limit applies only to YOU, the tutor.
* If a student asks you a question, answer it naturally.
  `;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
  model: "gpt-4o-mini",
  messages: [
  { role: "system", content: systemPrompt },
  ...cleanHistory,
  {
  role: "user",
  content: formatStudentMessage(message, speaker),
  },
  ],
  temperature: 0.85,
  max_tokens: 160,
  }),
  });

  const data = await response.json();

  if (!response.ok) {
  console.error("OpenAI API error:", data);
  return res.status(500).json({
  error: "OpenAI API error",
  details: data,
  });
  }

  let reply = data.choices?.[0]?.message?.content?.trim();

  if (!reply) {
  return res.status(500).json({
  error: "No reply generated",
  });
  }

  // Hard guard:
  // If this is a no-question turn but the tutor still asks a question,
  // remove question sentences.
  if (!allowTutorQuestion) {
  reply = removeQuestionSentences(reply);
  }

  if (!reply || reply.trim().length < 2) {
  reply = "That's interesting. I have a different taste in entertainment, but I can understand that opinion.";
  }

  return res.status(200).json({
  reply,
  response: reply,
  message: reply,
  text: reply,
  persona: selectedPersona,
  });
  } catch (error) {
  console.error("Chat API error:", error);

  return res.status(500).json({
  error: "Something went wrong.",
  details: error.message,
  });
  }
  }

function formatStudentMessage(message, speaker) {
const trimmed = message.trim();

// If index.html already sends "Student A: ...", do not add it again.
if (/^Student A:/i.test(trimmed) || /^Student B:/i.test(trimmed)) {
return trimmed;
}

return `${speaker}: ${trimmed}`;
}

function removeQuestionSentences(text) {
return text
.split(/(?<=[.!?])\s+/)
.filter((sentence) => !sentence.includes("?"))
.join(" ")
.trim();
}

function getPersona(providedPersona, sessionId) {
if (
providedPersona &&
providedPersona.name &&
providedPersona.country &&
providedPersona.reason
) {
return {
name: providedPersona.name,
country: providedPersona.country,
reason: providedPersona.reason,
personality: providedPersona.personality || "friendly and curious",
likes: providedPersona.likes || "music, movies, and talking with people",
dislikes: providedPersona.dislikes || "boring conversations",
};
}

const personas = [
{
name: "Sofia",
country: "Spain",
reason: "learning about Japanese pop culture",
personality: "warm, curious, and talkative",
likes: "live music, comedy movies, and photography",
dislikes: "horror movies and crowded trains",
},
{
name: "Liam",
country: "New Zealand",
reason: "snowboarding and visiting small towns in Japan",
personality: "relaxed, friendly, and outdoorsy",
likes: "rock music, action movies, and mountain towns",
dislikes: "big crowds and waking up early",
},
{
name: "Maya",
country: "India",
reason: "visiting Japanese universities and museums",
personality: "polite, thoughtful, and a little shy",
likes: "books, quiet cafes, and animated movies",
dislikes: "very noisy places and scary movies",
},
{
name: "Noah",
country: "Germany",
reason: "traveling around Japan by train",
personality: "calm, practical, and honest",
likes: "documentaries, science fiction, and trains",
dislikes: "being late and expensive restaurants",
},
{
name: "Ava",
country: "Brazil",
reason: "learning about Japanese festivals and music",
personality: "cheerful, energetic, and expressive",
likes: "dancing, festivals, J-pop, and comedy shows",
dislikes: "rainy days and quiet parties",
},
{
name: "Ethan",
country: "South Africa",
reason: "visiting a friend in Japan",
personality: "easygoing, funny, and social",
likes: "sports, games, barbecue, and meeting new people",
dislikes: "long lines and boring movies",
},
{
name: "Chloe",
country: "France",
reason: "learning about Japanese art, fashion, and film",
personality: "creative, stylish, and observant",
likes: "museums, fashion, coffee, and romantic comedies",
dislikes: "bad coffee and loud game centers",
},
{
name: "Omar",
country: "Egypt",
reason: "seeing Japanese castles and historical places",
personality: "curious, calm, and respectful",
likes: "history, movie soundtracks, and walking tours",
dislikes: "cold rain and getting lost",
},
{
name: "Ella",
country: "Finland",
reason: "experiencing Japanese nature and hot springs",
personality: "quiet, kind, and thoughtful",
likes: "reading, relaxing music, and nature videos",
dislikes: "humid weather and loud restaurants",
},
{
name: "Mateo",
country: "Mexico",
reason: "trying Japanese food and meeting local people",
personality: "funny, social, and adventurous",
likes: "soccer, karaoke, spicy food, and comedy movies",
dislikes: "strict schedules and bland food",
},
{
name: "Grace",
country: "Singapore",
reason: "shopping, sightseeing, and trying Japanese desserts",
personality: "friendly, organized, and curious",
likes: "social media, cafes, anime, and mystery movies",
dislikes: "messy plans and slow internet",
},
{
name: "Daniel",
country: "Ireland",
reason: "playing music and traveling around Japan",
personality: "funny, relaxed, and talkative",
likes: "guitar music, pubs, karaoke, and fantasy movies",
dislikes: "silent rooms and very spicy food",
},
];

const index = Math.abs(hashString(sessionId)) % personas.length;
return personas[index];
}

function hashString(str) {
let hash = 0;

for (let i = 0; i < str.length; i++) {
hash = (hash << 5) - hash + str.charCodeAt(i);
hash |= 0;
}

return hash;
}
