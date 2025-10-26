import { AzureOpenAI } from 'openai'
import '@azure/openai/types'
import { getConfigService } from '../config'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  maxTokens?: number
  temperature?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
}

export interface EmbeddingResult {
  embedding: number[]
  usage: {
    promptTokens: number
    totalTokens: number
  }
}

export interface ChatCompletionResult {
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason: string
}

interface EmbeddingData {
  embedding: number[]
  index: number
}

class AzureOpenAIService {
  private client: AzureOpenAI | null = null
  private deploymentName: string = ''
  private embeddingDeploymentName: string = ''

  async initialize(): Promise<void> {
    if (this.client) return

    const config = await getConfigService().getConfig()
    
    this.client = new AzureOpenAI({
      apiKey: config.azure.openai.apiKey,
      endpoint: config.azure.openai.endpoint,
      apiVersion: "2024-02-01"
    })
    
    this.deploymentName = config.azure.openai.deploymentName
    this.embeddingDeploymentName = config.azure.openai.embeddingDeploymentName
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    await this.initialize()
    
    if (!this.client) {
      throw new Error('Azure OpenAI client not initialized')
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.deploymentName,
        messages,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
      })

      const choice = response.choices[0]
      if (!choice?.message?.content) {
        throw new Error('No content in OpenAI response')
      }

      return {
        content: choice.message.content,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        finishReason: choice.finish_reason || 'unknown'
      }
    } catch (error) {
      console.error('Azure OpenAI chat completion error:', error)
      throw new Error(`Chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    await this.initialize()
    
    if (!this.client) {
      throw new Error('Azure OpenAI client not initialized')
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingDeploymentName,
        input: [text]
      })

      const embedding = response.data[0]?.embedding
      if (!embedding) {
        throw new Error('No embedding in OpenAI response')
      }

      return {
        embedding,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        }
      }
    } catch (error) {
      console.error('Azure OpenAI embedding error:', error)
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    await this.initialize()
    
    if (!this.client) {
      throw new Error('Azure OpenAI client not initialized')
    }

    // Process in batches to avoid rate limits
    const batchSize = 16
    const results: EmbeddingResult[] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      
      try {
        const response = await this.client.embeddings.create({
          model: this.embeddingDeploymentName,
          input: batch
        })

        const batchResults = response.data.map((item: EmbeddingData) => ({
          embedding: item.embedding,
          usage: {
            promptTokens: Math.floor((response.usage?.prompt_tokens || 0) / batch.length),
            totalTokens: Math.floor((response.usage?.total_tokens || 0) / batch.length),
          }
        }))

        results.push(...batchResults)
      } catch (error) {
        console.error(`Batch embedding error for batch ${i / batchSize + 1}:`, error)
        throw new Error(`Batch embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return results
  }
}

// Singleton instance
let azureOpenAIService: AzureOpenAIService | null = null

export function getAzureOpenAIService(): AzureOpenAIService {
  if (!azureOpenAIService) {
    azureOpenAIService = new AzureOpenAIService()
  }
  return azureOpenAIService
}

export { AzureOpenAIService }