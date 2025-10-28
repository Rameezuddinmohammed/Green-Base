# AI Confidence Scoring Refactor - Summary

## Overview
Implemented stricter confidence scoring and improved AI reliability to ensure only high-quality SOPs and internal wikis receive "Green" ratings suitable for batch approval.

---

## Changes Implemented

### 1. ✅ Adjusted Confidence Thresholds & Weights
**File:** `src/lib/ai/confidence-scoring.ts`

**Changes:**
- **GREEN_THRESHOLD:** Increased from `0.8` to `0.85` (only exceptional documents get green)
- **YELLOW_THRESHOLD:** Increased from `0.5` to `0.60` (pushes borderline docs to red)
- **Weight Distribution:** Prioritized clarity and density for SOPs
  - `contentClarity`: 0.4 (was 0.3) - Most important for SOPs
  - `informationDensity`: 0.3 (was 0.2) - High-quality content should be dense
  - `sourceConsistency`: 0.2 (was 0.3) - Less critical for single documents
  - `authorityScore`: 0.1 (was 0.2) - Least critical factor

**Impact:** Only truly exceptional, production-ready documents will achieve green status.

---

### 2. ✅ Refined Heuristic Factor Calculations
**File:** `src/lib/ai/confidence-scoring.ts`

#### `assessContentClarity` Improvements:
- **Base score reduced:** From 0.2 to 0.1
- **Multi-indicator requirement:** Now requires multiple positive indicators (headings, numbered lists, proper sentences, etc.)
- **Scoring tiers:** 
  - 5-6 indicators: 0.8 (excellent)
  - 4 indicators: 0.65
  - 3 indicators: 0.5
  - 2 indicators: 0.35
  - 1 indicator: 0.2
- **Heavy penalties:**
  - Content < 150 chars: 70% penalty
  - Content < 300 chars: 40% penalty
  - < 5 lines: 50% penalty
  - No headings or numbered lists: 40% penalty

#### `assessSourceConsistency` Improvements:
- **Single source score reduced:** From 0.7 to 0.5

#### `assessInformationDensity` Improvements:
- **Stricter noise detection:** Added more filler words and abbreviations
- **Increased penalties:**
  - Content < 100 chars: 80% penalty (was 70%)
  - Content < 200 chars: 60% penalty (was 50%)
  - Content < 400 chars: 40% penalty (was 30%)
- **Repetition penalties:**
  - < 40% unique words: 60% penalty
  - < 60% unique words: 30% penalty
- **Question penalty:** Too many questions (>3) indicates uncertainty

**Impact:** Heuristic fallback is now much more conservative and strict.

---

### 3. ✅ Improved AI Assessment Reliability & Prompts
**Files:** `src/lib/ai/ai-integration-service.ts`, `src/lib/ai/prompt-templates.ts`

#### AI Assessment Parsing Improvements:
- **Better JSON extraction:** Handles markdown code blocks and extra text
- **Robust validation:** Validates structure before using AI scores
- **Improved fallback:** Better regex extraction with bounds checking
- **Enhanced logging:** Clear success/failure indicators

#### `confidenceAssessment` Prompt Improvements:
- **SOP-specific criteria:** Focuses on numbered steps, actionable language, professional formatting
- **Stricter guidelines:** Explicitly states most content should score 0.3-0.6
- **Critical red flags:** Lists specific issues that should result in low scores
- **Clearer JSON format:** Emphasizes returning ONLY valid JSON

#### `contentStructuring` Prompt Improvements:
- **SOP formatting standards:** Encourages numbered lists for procedures
- **Professional tone:** Removes conversational language
- **Clear structure requirements:** Specific markdown formatting guidelines
- **Actionable language:** Emphasizes unambiguous, professional writing

**Impact:** AI assessments are more reliable and consistent, with better SOP-style output.

---

### 4. ✅ Implemented Production PII Redaction
**File:** `src/lib/ai/pii-redaction.ts`

**Changes:**
- **Azure AI Language integration:** Replaced TODO with actual implementation
- **PII Entity Recognition:** Uses Azure's advanced PII detection
- **Confidence threshold:** Only redacts entities above threshold (0.8)
- **Multiple categories:** Detects Person, Email, Phone, Address, Organization, etc.
- **PHI domain filter:** Includes Protected Health Information detection
- **Graceful fallback:** Falls back to regex if Azure service fails

**Impact:** Significantly improved security and data privacy with production-grade PII detection.

---

## Expected Outcomes

### Score Distribution:
- **Green (≥0.85):** Only exceptional, production-ready SOPs and wikis
- **Yellow (0.60-0.84):** Decent content that needs review
- **Red (<0.60):** Poor quality content requiring significant review

### Quality Improvements:
1. Fewer documents landing in "Yellow" - clearer distinction between good and bad
2. Only truly high-quality documents achieving "Green" for batch approval
3. More reliable AI assessments with better JSON parsing
4. SOP-style formatting in structured content
5. Production-grade PII redaction for security

### User Experience:
- Managers can trust "Green" items for batch approval
- "Red" items clearly need attention
- Better structured output that looks like professional documentation
- Improved security with proper PII handling

---

## Testing Recommendations

1. **Upload test files with varying quality:**
   - Poor quality: Conversational, short, unstructured
   - Medium quality: Some structure but incomplete
   - High quality: Professional SOP with numbered steps

2. **Verify score distribution:**
   - Most files should NOT be green
   - Clear differentiation between quality levels

3. **Check structured output:**
   - Should use numbered lists for procedures
   - Professional tone and formatting
   - Clear headings and sections

4. **Test PII redaction:**
   - Upload content with emails, phone numbers, names
   - Verify proper redaction in processed documents

---

## Configuration Notes

The Azure AI Language service uses the same credentials as the Speech service. Ensure your `.env.local` has:
```
AZURE_SPEECH_KEY=your_key
AZURE_SPEECH_REGION=your_region
```

The PII redaction will automatically fall back to regex-based detection if the Azure service is unavailable.
