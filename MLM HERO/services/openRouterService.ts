
interface OpenRouterOptions {
    prompt: string;
    apiKey: string;
    model: string;
    sourceImage?: string; // base64
}

export const generateOpenRouterVideo = async ({
    prompt,
    apiKey,
    model,
    sourceImage
}: OpenRouterOptions): Promise<string> => {
    
    const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.href,
        "X-Title": "Dream3DForge",
        "Content-Type": "application/json"
    };

    const messages: any[] = [
        {
            role: "user",
            content: [
                { type: "text", text: prompt }
            ]
        }
    ];

    if (sourceImage) {
        messages[0].content.push({
            type: "image_url",
            image_url: {
                url: sourceImage
            }
        });
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: messages,
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "OpenRouter API Failed");
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (!content) throw new Error("No content returned from OpenRouter");

        const urlRegex = /(https?:\/\/[^\s)]+\.(?:mp4|mov|webm))/i;
        const match = content.match(urlRegex);

        if (match) {
            return match[1];
        } else {
            if (content.startsWith("http")) return content;
            throw new Error("Model returned text instead of a video URL.");
        }

    } catch (error) {
        console.error("OpenRouter Error:", error);
        throw error;
    }
};
