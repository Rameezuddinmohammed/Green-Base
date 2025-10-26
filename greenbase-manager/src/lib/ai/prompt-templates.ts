export interface ContentStructuringInput {
  sourceContent: string[]
  sourceType: 'teams' | 'google_drive'
  metadata: {
    sourceCount: number
    totalLength: number
    piiEntitiesFound: number
  }
}

export interface TopicIdentificationInput {
  content: string
  existingTopics?: string[]
}

export interface ConfidenceAssessmentInput {
  structuredContent: string
  sourceQuality: number
  contentLength: number
  sourceCount: number
}

export class PromptTemplates {
  static contentStructuring(input: ContentStructuringInput) {
    return {
      system: `You are an expert content structurer. Your task is to take raw content from ${input.sourceType} and create a well-structured, coherent document.

Guidelines:
- Create clear headings and sections
- Maintain factual accuracy
- Remove redundant information
- Use proper markdown formatting
- Preserve important details and context
- Ensure the content flows logically

The content has been processed for PII removal (${input.metadata.piiEntitiesFound} entities found).`,

      user: `Please structure the following content from ${input.metadata.sourceCount} source(s):

${input.sourceContent.join('\n\n---\n\n')}

Create a well-structured document with:
1. A clear title
2. Organized sections with headings
3. Bullet points or numbered lists where appropriate
4. A brief summary at the end

Return only the structured content in markdown format.`
    }
  }

  static topicIdentification(input: TopicIdentificationInput) {
    const existingTopicsText = input.existingTopics?.length 
      ? `\n\nExisting topics in the system: ${input.existingTopics.join(', ')}`
      : ''

    return {
      system: `You are a topic classification expert. Analyze content and identify 2-5 relevant topics that best categorize the document.

Rules:
- Return topics as a JSON array of strings
- Use existing topics when appropriate
- Create new topics only when necessary
- Topics should be concise (1-3 words)
- Focus on the main themes and subject matter${existingTopicsText}`,

      user: `Analyze this content and identify the most relevant topics:

${input.content}

Return your response as a JSON array of topic strings, for example: ["HR Policy", "Remote Work", "Benefits"]`
    }
  }

  static confidenceAssessment(input: ConfidenceAssessmentInput) {
    return {
      system: `You are a content quality assessor. Evaluate the given structured content and provide confidence metrics.

Assess these factors (0.0 to 1.0):
- contentClarity: How well-structured and clear is the content?
- informationCompleteness: How complete and comprehensive is the information?
- factualConsistency: How consistent and reliable does the information appear?

Consider:
- Source quality: ${input.sourceQuality}
- Content length: ${input.contentLength} characters
- Number of sources: ${input.sourceCount}`,

      user: `Assess the quality and confidence level of this structured content:

${input.structuredContent}

Return your assessment as JSON with this structure:
{
  "factors": {
    "contentClarity": 0.8,
    "informationCompleteness": 0.7,
    "factualConsistency": 0.9
  },
  "overallConfidence": 0.8,
  "reasoning": "Brief explanation of the assessment"
}`
    }
  }

  static intentRecognition(userInput: string, availableDocuments: string[]) {
    return {
      system: `You are an intent recognition system. Analyze user input to determine what they want to do with documentation.

Possible intents:
- "add": Add new information to existing document
- "modify": Change existing information
- "delete": Remove information
- "create_new": Create entirely new document

Return JSON with:
- intent: one of the above
- targetDocument: document name or null for create_new
- proposedChanges: description of what should change
- confidence: 0.0 to 1.0
- newContent: the actual content to add/modify (if applicable)`,

      user: `User input: "${userInput}"

Available documents: ${availableDocuments.join(', ')}

Analyze the intent and return JSON response.`
    }
  }

  static questionAnswering(question: string, contextDocuments: string[]) {
    return {
      system: `You are a helpful assistant that answers questions based on provided context documents. 

Guidelines:
- Only use information from the provided context
- If you don't have enough information, say so clearly
- Cite which documents you're referencing when possible
- Be concise but comprehensive
- If the question is unclear, ask for clarification`,

      user: `Question: ${question}

Context documents:
${contextDocuments.join('\n\n---\n\n')}

Please provide a helpful answer based on the context provided.`
    }
  }
}