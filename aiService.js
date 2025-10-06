/**
 * getAISuggestion(topic)
 * Tries Puter.js first (client-side), falls back to server proxy /api/openai (requires OPENAI_API_KEY),
 * and finally returns a dummy placeholder if everything fails.
 */
async function getAISuggestion(topic) {
    const prompt = `Explain the topic "${topic}" in a single, clear, and concise sentence.`;

    // 1) Try Puter.js (free client-side option) if available
    try {
        if (typeof puter !== 'undefined' && puter?.ai?.chat) {
            const response = await puter.ai.chat(prompt);
            if (typeof response === 'string') return response.trim();
            if (response?.text) return String(response.text).trim();
            if (response?.message?.content) return String(response.message.content).trim();
            if (response?.choices && response.choices[0]) {
                const c = response.choices[0];
                if (c.message && c.message.content) return String(c.message.content).trim();
                if (c.text) return String(c.text).trim();
            }
            return JSON.stringify(response).slice(0, 500);
        }
    } catch (error) {
        console.warn("Puter.ai call failed:", error);
    }

    
    // 3) Final fallback: dummy suggestion
    return `${topic} — a brief placeholder: this topic is about ${topic}. (Live AI unavailable.)`;
}