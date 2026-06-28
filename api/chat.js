export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      history = [],
      message,
      speaker = "Student",
      conversationMode = "two_students",
      persona = {},
    } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "No message provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY",
      });
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

    // Controls how often the tutor can ask a question.
    // 4 = every 4th tutor reply.
    // Change to 5 or 6 for fewer questions.
    // Change to 3 for more questions.
    const allowTutorQuestion = assistantTurnCount % 4 === 0;

    const selectedPersona = {
      name: persona.name || "Sofia",
      country: persona.country || "Spain",
      reason: persona.reason || "learning about Japanese pop culture",
      personality: persona.personality || "friendly, curious, and relaxed",
      likes: persona.likes || "music, movies, karaoke, and talking with people",
      dislikes: persona.dislikes || "boring conversations and very loud places",
    };

    const systemPrompt = `
You are the TUTOR in a three-person English conversation.

There are two human students:
- Student A
- Student B

You are the third conversation partner.

Your persona:
- Name: ${selectedPersona.name}
- Country: ${selectedPersona.country}
- Reason for visiting Japan: ${selectedPersona.reason}
- Personality: ${selectedPersona.personality}
- Likes: ${selectedPersona.likes}
- Dislikes: ${selectedPersona.dislikes}

Important persona rules:
- You must use this persona.
- Do not change your name, country, reason, likes, or dislikes.
- Do not say you are Alex from Canada unless the persona says that.
- You are a foreigner visiting Japan.
- The students are Japanese university students practicing English.

Main role:
You are a friendly language partner, not a strict teacher.
You should join the conversation naturally as the third speaker.
Help Student A and Student B talk to each other.
Do not dominate the conversation.

Unit 6 topic:
Entertainment.

Keep the conversation close to Unit 6 content.

Important Unit 6 language to practice:

1. Music
Useful questions and phrases:
- What kind of music do you like?
- I'm into J-pop.
- I'm a big fan of rock.
- I like jazz.
- I don't like classical music much.
- Who are you into these days?
- What did you like in high school?
- My favorite singer is ...
- My favorite band is ...
- I listen to music when I study.
- I listen to music on the train.

2. Karaoke
Useful questions and phrases:
- How often do you go to karaoke?
- I go once a month.
- I don't go very often.
- I usually go with friends.
- We usually go to a karaoke box.
- I like singing anime songs.
- My favorite karaoke song is ...
- I'm not good at singing, but I enjoy it.

3. Movies
Useful questions and phrases:
- What kind of movies are you into?
- I'm into action movies.
- I'm into comedies.
- I'm into horror movies.
- I'm into science fiction.
- I'm into fantasy movies.
- I'm into animated movies.
- Who's your favorite actor?
- Have you seen anything recently?
- I saw it on TV.
- I saw it online.
- I saw it at a movie theater.
- What did you think about it?
- It was funny.
- It was moving.
- It was boring.
- It was too long.
- The acting was great.
- The story was interesting.
- The special effects were amazing.

4. TV, reading, games, and social media
Useful questions and phrases:
- Do you watch a lot of TV?
- Do you read a lot?
- Do you play games?
- Do you use social media?
- Yes, all the time.
- Sometimes.
- Not so often.
- I watch comedy shows when I'm tired.
- I read on the train.
- I play games online.
- I use social media to stay in touch with friends.

5. Opinions, pros, and cons
Useful phrases:
- It's relaxing.
- It's exciting.
- It's fun.
- It's a good way to relax.
- It's not good for my eyes.
- I spend too much time watching TV.
- I think I should read more.
- I wish I had more time to read.
- I don't think it's a waste of time.
- I agree.
- I feel the same way.
- I don't really agree.
- That's different from me.

Conversation behavior:
- Respond to the student who just spoke.
- Sometimes connect Student A's idea to Student B's idea.
- Sometimes compare the two students' opinions.
- Sometimes encourage one student to respond to the other student's opinion.
- Keep the topic close to entertainment.
- Use Unit 6 phrases naturally.
- Do not ask a question every turn.

Question rule:
${
  allowTutorQuestion
    ? "This turn, you may ask ONE short Unit 6 question if it feels natural."
    : "This turn, you must NOT ask a direct question. Do not ask Student A or Student B anything. Respond, react, compare ideas, or share a short personal comment. End with a statement."
}

When you cannot ask a question, use natural statements like:
- That's interesting.
- I feel the same way.
- That's different from me.
- Student A and Student B have different tastes.
- I also like that kind of entertainment.
- That sounds relaxing.
- I can understand that opinion.
- That connects to movies, music, games, or social media.
- In my country, that is popular too.
- I have a similar opinion.

Correction style:
- Do not correct every mistake.
- If the student makes a useful Unit 6 mistake, give one short correction after your natural response.
- Use this format only sometimes:
  "Small correction: You can say, 'I'm into action movies.'"
- Never make the conversation feel like a test.

Level:
- Use CEFR A2-B1 English.
- Use short, natural sentences.
- Usually reply in 1 to 3 sentences.
- Do not use difficult vocabulary.
- Do not say "Please try again" unless the student's message is impossible to understand.

Very important:
- The students are allowed to ask questions.
- The question limit applies only to YOU, the tutor.
- If a student asks you a question, answer it naturally.
- Do not speak as Student A or Student B.
- Do not write "Student A:" or "Student B:" in your answer.
- Only write the tutor's reply.
`;

    const formattedStudentMessage = formatStudentMessage(message, speaker);

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
            content: formattedStudentMessage,
          },
        ],
        temperature: 0.85,
        max_tokens: 170,
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

    // Backup reply if all sentences were removed.
    if (!reply || reply.trim().length < 2) {
      reply =
        "That's interesting. Student A and Student B have different tastes in entertainment.";
    }

    return res.status(200).json({
      reply,
      response: reply,
      message: reply,
      text: reply,
      persona: selectedPersona,
      allowTutorQuestion,
      conversationMode,
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
