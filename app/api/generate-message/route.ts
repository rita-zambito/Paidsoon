import { NextResponse } from "next/server";

type GenerateMessageBody = {
  customer: string;
  invoiceNumber: string;
  amount: number;
  tone: "gentle" | "firm" | "final";
  paymentNote: string;
  signOff: string;
  businessName?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type OpenAIResponse = {
  output_text?: string;
};

export async function POST(request: Request) {
  const body = await request.json() as GenerateMessageBody;
  const prompt = buildPrompt(body);

  if (process.env.GEMINI_API_KEY) {
    const geminiResult = await generateWithGemini(prompt);

    if (geminiResult.message) {
      return NextResponse.json({ message: geminiResult.message });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: geminiResult.error || "Gemini generation failed." }, { status: 400 });
    }
  }

  if (process.env.OPENAI_API_KEY) {
    const openAiResult = await generateWithOpenAI(prompt);

    if (openAiResult.message) {
      return NextResponse.json({ message: openAiResult.message });
    }

    return NextResponse.json({ error: openAiResult.error || "OpenAI generation failed." }, { status: 400 });
  }

  return NextResponse.json({ error: "No AI API key is configured." }, { status: 400 });
}

function buildPrompt(body: GenerateMessageBody) {
  const toneInstructions = {
    gentle: "warm, brief, friendly, and low-pressure",
    firm: "professional, clear, and firmer while staying polite",
    final: "serious and direct, but not threatening or legally aggressive"
  };

  return `You write concise UK business payment reminder messages.

Write a ${toneInstructions[body.tone]} payment chase message.

Customer: ${body.customer}
Invoice number: ${body.invoiceNumber}
Amount: £${body.amount}
Business name: ${body.businessName || "the sender's business"}
Payment note: ${body.paymentNote}
Sign-off:
${body.signOff}

Rules:
- Output only the message body.
- Keep it under 130 words.
- Use UK English.
- Be polite and natural.
- Mention the invoice number and amount.
- Include the payment note if relevant.
- End with the provided sign-off.
- Avoid legal claims, threats, fake deadlines, harassment, or pretending a message was already sent.`;
}

async function generateWithGemini(prompt: string) {
  const model = "gemini-2.5-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 220
      }
    })
  });

  if (!response.ok) {
    return { error: await response.text() };
  }

  const data = await response.json() as GeminiResponse;
  const message = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  return { message };
}

async function generateWithOpenAI(prompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      reasoning: { effort: "none" },
      input: prompt
    })
  });

  if (!response.ok) {
    return { error: await response.text() };
  }

  const data = await response.json() as OpenAIResponse;
  return { message: data.output_text?.trim() };
}
