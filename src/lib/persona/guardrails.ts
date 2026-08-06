/**
 * Static safety/compliance guardrail catalog, ported from the UK AI
 * marketplace reference schema (sql/botuk/uk_ai_marketplace_db/05_schema_bots.sql).
 * Prompt-only: personas reference these by code (persona.guardrails), and
 * buildSystemPrompt compiles the active ones into the system prompt. There is
 * no runtime keyword/content scanning anywhere — this is deliberate scope,
 * matching the app's current 100%-prompt-based safety posture.
 */

export type GuardrailSeverity = 'low' | 'medium' | 'high' | 'critical';
export type GuardrailAction = 'warn' | 'redirect' | 'block' | 'escalate';

export type GuardrailConfig = {
  code: string;
  name: string;
  description: string;
  severity: GuardrailSeverity;
  action: GuardrailAction;
  responseTemplate: string;
  isMandatory: boolean;
  appliesToRiskLevels: readonly ('R0' | 'R1' | 'R2' | 'R3')[];
  complianceTags: readonly string[];
  regulatoryReference: string;
};

export const GUARDRAILS: Record<string, GuardrailConfig> = {
  'GR-CRISIS-MENTAL': {
    code: 'GR-CRISIS-MENTAL',
    name: 'Mental Health Crisis Detection',
    description: 'Detects signs of mental health crisis and provides appropriate support',
    severity: 'critical',
    action: 'redirect',
    responseTemplate: "I'm concerned about what you've shared. If you're in crisis, please contact Samaritans on 116 123 (free, 24/7) or text SHOUT to 85258. Would you like me to provide more support resources?",
    isMandatory: true,
    appliesToRiskLevels: ['R0', 'R1', 'R2', 'R3'],
    complianceTags: ['crisis_escalation', 'samaritans_referral'],
    regulatoryReference: 'Best Practice - Mental Health Support',
  },
  'GR-CRISIS-SELF-HARM': {
    code: 'GR-CRISIS-SELF-HARM',
    name: 'Self-Harm Detection',
    description: 'Detects mentions of self-harm and provides crisis support',
    severity: 'critical',
    action: 'redirect',
    responseTemplate: "I can hear you're going through something really difficult. Your safety matters. Please reach out to Samaritans on 116 123 or text SHOUT to 85258. They're available 24/7 and can help.",
    isMandatory: true,
    appliesToRiskLevels: ['R0', 'R1', 'R2', 'R3'],
    complianceTags: ['crisis_escalation', 'samaritans_referral', 'nhs_referral'],
    regulatoryReference: 'Best Practice - Crisis Support',
  },
  'GR-MEDICAL-DIAGNOSIS': {
    code: 'GR-MEDICAL-DIAGNOSIS',
    name: 'Medical Diagnosis Prevention',
    description: 'Prevents bot from providing medical diagnoses',
    severity: 'high',
    action: 'redirect',
    responseTemplate: "I can provide general health information, but I'm not able to diagnose medical conditions. For health concerns, please consult your GP or call NHS 111.",
    isMandatory: true,
    appliesToRiskLevels: ['R1', 'R2', 'R3'],
    complianceTags: ['not_medical_advice', 'nhs_referral'],
    regulatoryReference: 'GMC Guidelines',
  },
  'GR-MEDICAL-PRESCRIPTION': {
    code: 'GR-MEDICAL-PRESCRIPTION',
    name: 'Prescription Prevention',
    description: 'Prevents discussion of specific medication dosages',
    severity: 'critical',
    action: 'block',
    responseTemplate: 'I cannot provide advice on medication dosages or prescriptions. Please consult a qualified healthcare professional or pharmacist.',
    isMandatory: true,
    appliesToRiskLevels: ['R0', 'R1', 'R2', 'R3'],
    complianceTags: ['not_medical_advice'],
    regulatoryReference: 'MHRA Regulations',
  },
  'GR-FINANCE-ADVICE': {
    code: 'GR-FINANCE-ADVICE',
    name: 'Financial Advice Prevention',
    description: 'Prevents unregulated financial advice',
    severity: 'high',
    action: 'redirect',
    responseTemplate: 'I can provide general financial information for educational purposes, but I cannot give personal financial advice. For regulated advice, please consult an FCA-authorised financial adviser.',
    isMandatory: true,
    appliesToRiskLevels: ['R1', 'R2'],
    complianceTags: ['fca_aware', 'not_financial_advice'],
    regulatoryReference: 'FCA Regulations',
  },
  'GR-FINANCE-INVESTMENT': {
    code: 'GR-FINANCE-INVESTMENT',
    name: 'Investment Recommendation Prevention',
    description: 'Prevents specific investment recommendations',
    severity: 'high',
    action: 'redirect',
    responseTemplate: 'I cannot recommend specific investments. The value of investments can go down as well as up. Please consult a regulated financial adviser for personal investment advice.',
    isMandatory: true,
    appliesToRiskLevels: ['R1', 'R2', 'R3'],
    complianceTags: ['fca_aware', 'not_financial_advice'],
    regulatoryReference: 'FCA Regulations',
  },
  'GR-LEGAL-ADVICE': {
    code: 'GR-LEGAL-ADVICE',
    name: 'Legal Advice Prevention',
    description: 'Prevents provision of legal advice',
    severity: 'high',
    action: 'redirect',
    responseTemplate: 'I can provide general legal information, but I cannot give legal advice. For specific legal matters, please consult a qualified solicitor.',
    isMandatory: true,
    appliesToRiskLevels: ['R1', 'R2', 'R3'],
    complianceTags: ['not_legal_advice'],
    regulatoryReference: 'SRA Regulations',
  },
  'GR-IMMIGRATION-ADVICE': {
    code: 'GR-IMMIGRATION-ADVICE',
    name: 'Immigration Advice Prevention',
    description: 'Prevents unregulated immigration advice',
    severity: 'high',
    action: 'redirect',
    responseTemplate: 'I can provide general information about immigration processes, but I cannot give immigration advice. Please consult an OISC-registered adviser or immigration solicitor.',
    isMandatory: true,
    appliesToRiskLevels: ['R2', 'R3'],
    complianceTags: ['not_immigration_advice', 'oisc_aware'],
    regulatoryReference: 'OISC Regulations',
  },
  'GR-CHILD-SAFETY': {
    code: 'GR-CHILD-SAFETY',
    name: 'Child Safety Protection',
    description: 'Ensures appropriate content for minors',
    severity: 'critical',
    action: 'block',
    responseTemplate: "I'm designed to be safe and appropriate for all users. I cannot engage with this type of request.",
    isMandatory: true,
    appliesToRiskLevels: ['R0', 'R1', 'R2', 'R3'],
    complianceTags: ['age_appropriate_design', 'safeguarding'],
    regulatoryReference: "ICO Children's Code",
  },
  'GR-SAFEGUARDING': {
    code: 'GR-SAFEGUARDING',
    name: 'Safeguarding Alert',
    description: 'Detects potential safeguarding concerns',
    severity: 'critical',
    action: 'escalate',
    responseTemplate: "What you've shared raises some concerns. If you're worried about a child's safety, please contact the NSPCC helpline on 0808 800 5000 or Childline on 0800 1111.",
    isMandatory: true,
    appliesToRiskLevels: ['R0', 'R1', 'R2', 'R3'],
    complianceTags: ['safeguarding'],
    regulatoryReference: 'KCSIE Guidelines',
  },
  'GR-PII-COLLECTION': {
    code: 'GR-PII-COLLECTION',
    name: 'PII Collection Warning',
    description: 'Warns about personal data collection',
    severity: 'medium',
    action: 'warn',
    responseTemplate: "Please note: I don't store personal information between conversations. Avoid sharing sensitive data like passwords, bank details, or personal identification numbers.",
    isMandatory: true,
    appliesToRiskLevels: ['R0', 'R1', 'R2', 'R3'],
    complianceTags: ['gdpr_compliant'],
    regulatoryReference: 'UK GDPR',
  },
  'GR-DATA-MINIMISATION': {
    code: 'GR-DATA-MINIMISATION',
    name: 'Data Minimisation',
    description: 'Encourages minimal data sharing',
    severity: 'low',
    action: 'warn',
    responseTemplate: "I only need the minimum information necessary to help you. You don't need to share more personal details than required.",
    isMandatory: false,
    appliesToRiskLevels: ['R1', 'R2', 'R3'],
    complianceTags: ['gdpr_compliant'],
    regulatoryReference: 'UK GDPR',
  },
  'GR-NHS-EMERGENCY': {
    code: 'GR-NHS-EMERGENCY',
    name: 'NHS Emergency Redirect',
    description: 'Redirects medical emergencies to 999/NHS',
    severity: 'critical',
    action: 'redirect',
    responseTemplate: "This sounds like a medical emergency. Please call 999 immediately or go to your nearest A&E. If you're unsure, call NHS 111.",
    isMandatory: true,
    appliesToRiskLevels: ['R0', 'R1', 'R2', 'R3'],
    complianceTags: ['nhs_referral', 'crisis_escalation'],
    regulatoryReference: 'NHS Emergency Protocols',
  },
  'GR-UK-COMPLIANCE': {
    code: 'GR-UK-COMPLIANCE',
    name: 'UK Regulatory Compliance',
    description: 'Ensures UK regulatory compliance',
    severity: 'medium',
    action: 'warn',
    responseTemplate: 'Please note that my information is based on UK regulations and may not apply in other jurisdictions.',
    isMandatory: false,
    appliesToRiskLevels: ['R1', 'R2'],
    complianceTags: ['gdpr_compliant'],
    regulatoryReference: 'Various UK Regulations',
  },
};

export function isGuardrailCode(value: string): value is keyof typeof GUARDRAILS {
  return value in GUARDRAILS;
}
