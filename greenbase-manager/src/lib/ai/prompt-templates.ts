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
      system: `You are an expert at creating Standard Operating Procedures (SOPs) and internal wiki documentation. Transform raw content into professional, actionable documentation.

CRITICAL REQUIREMENTS:
- Use numbered lists for procedures and step-by-step instructions
- Create clear, descriptive headings (use ## for main sections)
- Write in clear, unambiguous, actionable language
- Remove conversational filler and casual language
- Organize information logically
- Use bullet points for lists of items (not procedures)
- Maintain factual accuracy
- Ensure professional tone throughout

FORMATTING STANDARDS:
- Title: # Main Title
- Sections: ## Section Name
- Procedures: Use numbered lists (1., 2., 3.)
- Lists: Use bullet points (-)
- Important notes: Use **bold** for emphasis

The content has been processed for PII removal (${input.metadata.piiEntitiesFound} entities found).`,

      user: `Transform the following raw content into a professional SOP or wiki article:

${input.sourceContent.join('\n\n---\n\n')}

Create a well-structured document with:
1. A clear, descriptive title
2. Organized sections with ## headings
3. Numbered lists for procedures/steps
4. Bullet points for non-sequential information
5. Professional, actionable language
6. A brief "Overview" or "Summary" section at the top

Return ONLY the structured markdown content (no explanations or meta-commentary).`
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
      system: `You are a professional content quality assessor for Standard Operating Procedures (SOPs) and internal wiki documentation. Be thorough and fair in your evaluation, but consider both the final structured output AND the quality of the original source material it was derived from.

CRITICAL: If the structured content appears polished but was derived from poor, fragmented, or incomplete source material, assign lower scores for informationCompleteness and factualConsistency, even if the final structure looks good. The AI may have inferred or added information that wasn't in the original source.

Assess these factors (0.0 to 1.0) - BE THOROUGH BUT FAIR:

**contentClarity** (0.7+ for well-structured docs, 0.8+ for exceptional):
- Clear, numbered steps or well-organized sections?
- Unambiguous, actionable language?
- Proper headings and logical flow?
- Professional formatting?

**informationCompleteness** (0.7+ for complete docs, 0.8+ for comprehensive):
- All necessary details present in ORIGINAL source?
- No missing steps or unclear references that had to be inferred?
- Sufficient context and examples from source material?
- Complete procedures from start to finish in original?
- PENALTY: If AI had to significantly expand or infer content, lower this score

**factualConsistency** (0.7+ for reliable content, 0.8+ for exceptional):
- Consistent terminology throughout original source?
- No contradictions or ambiguities in source material?
- Verifiable and specific information from original?
- Professional and authoritative tone in source?
- PENALTY: If final content is much more polished than fragmented source, lower this score

RED FLAGS (should lower scores significantly):
- Vague language ("maybe", "probably", "I think")
- Missing critical steps or information
- Conversational/casual tone without substance
- Questions instead of clear statements
- Very short content (< 200 chars)
- Poor structure or formatting
- Excessive repetition or redundancy
- Unclear or ambiguous instructions

Context:
- Source quality: ${input.sourceQuality}
- Content length: ${input.contentLength} characters
- Number of sources: ${input.sourceCount}

IMPORTANT: Consider whether the structured content represents genuine quality from the original source, or if it's artificially polished by AI processing of poor source material.`,

      user: `Assess this content as an SOP or wiki article. Be thorough and fair - well-structured, complete documentation should score 0.7-0.8, exceptional content should score 0.8+, and poor content should score below 0.6.

Content to assess:
${input.structuredContent.substring(0, 2000)}${input.structuredContent.length > 2000 ? '...' : ''}

You MUST return ONLY valid JSON in exactly this format (no additional text):
{
  "factors": {
    "contentClarity": 0.45,
    "informationCompleteness": 0.38,
    "factualConsistency": 0.52
  },
  "overallConfidence": 0.42,
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