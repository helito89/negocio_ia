import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class LlmService {
    constructor(private configService: ConfigService) {
    }

    ollamaBaseUrl = this.configService.get<string>('OLLAMA_BASE_URL');
    embeddingModel= this.configService.get<string>('EMBEDDING_MODEL');

    async generateResponse(prompt: string, context?: string): Promise<string> {

        try {
            const fullPrompt = context
                ? `Contexto: ${context}\n\nPregunta: ${prompt}\n\nRespuesta:`
                : prompt;

            const response = await fetch(`${this.ollamaBaseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.embeddingModel,
                    prompt: fullPrompt,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        num_predict: 500,
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.response || 'No response generated';
        } catch (error) {
            throw new Error(`Error generating LLM response: ${error.message}`);
        }
    }

    async generateResponseWithHistory(
        prompt: string,
        messageHistory: Array<{ role: string, content: string }>
    ): Promise<string> {
        try {
            // Convertir historial al formato de Ollama
            const messages = [
                {
                    role: 'system',
                    content: 'Eres un asistente útil que mantiene conversaciones naturales.'
                },
                ...messageHistory,
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const response = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.embeddingModel,
                    messages: messages,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        num_predict: 500,
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.message?.content || 'No response generated';
        } catch (error) {
            throw new Error(`Error generating LLM response with history: ${error.message}`);
        }
    }
}