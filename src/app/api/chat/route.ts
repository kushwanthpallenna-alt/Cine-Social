import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_INSTRUCTION = `You are CineAI, an expert cinematic curator with deep narrative analysis skills.
Your task is to recommend movies, discuss cinematic elements (pacing, cinematography, themes), and provide tailored cinematic experiences to the user.
Keep your responses concise, engaging, and stylized. Answer directly without pleasantries. Focus on the art of filmmaking and storytelling.`;

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { text: "It seems the GEMINI_API_KEY is missing in your environment variables. Please add it to .env.local to enable CineAI." },
        { status: 200 }
      );
    }

    const formattedHistory = history?.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    })) || [];

    const contents = [
      ...formattedHistory,
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message || "An error occurred during chat processing." }, { status: 500 });
  }
}
