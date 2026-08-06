/**
 * Static audience-segment catalog, ported from the UK AI marketplace reference
 * schema (sql/botuk/uk_ai_marketplace_db/02_schema_audiences.sql). Admin/data
 * only for now — personas can tag themselves with segment codes
 * (persona.audienceSegments) for future targeting/matching work, but nothing
 * here is wired into live behavior (e.g. buildSystemPrompt) yet.
 */

export type RiskSensitivity = 'low' | 'medium' | 'medium_high' | 'high' | 'very_high' | 'critical';
export type NarrativeFitLevel = 'low' | 'low_medium' | 'medium' | 'medium_high' | 'high' | 'very_high';

export type AudienceSegmentConfig = {
  code: string;
  audienceType: 'B2C' | 'B2B' | 'B2G';
  name: string;
  description: string;
  ageRangeMin?: number;
  ageRangeMax?: number;
  ukContext?: string;
  ukMarketSize?: string;
  keyNeeds: readonly string[];
  decisionFactors?: readonly string[];
  riskSensitivity: RiskSensitivity;
  narrativeFit?: NarrativeFitLevel;
  preferredTone?: readonly string[];
};

export const AUDIENCE_SEGMENTS: Record<string, AudienceSegmentConfig> = {
  // --- B2C: Children and young people ---
  'B2C-CYP-01': { code: 'B2C-CYP-01', audienceType: 'B2C', name: 'Early Years', description: 'Children in nursery and reception', ageRangeMin: 3, ageRangeMax: 5, ukContext: 'Nursery, Reception', keyNeeds: ['play_based_learning', 'phonics_introduction', 'emotional_regulation', 'motor_skills', 'social_development'], riskSensitivity: 'high', narrativeFit: 'very_high', preferredTone: ['playful', 'gentle', 'encouraging', 'simple'] },
  'B2C-CYP-02': { code: 'B2C-CYP-02', audienceType: 'B2C', name: 'KS1 Learners', description: 'Key Stage 1 students', ageRangeMin: 5, ageRangeMax: 7, ukContext: 'Year 1-2', keyNeeds: ['reading_fluency', 'numeracy_basics', 'curiosity_building', 'writing_foundations'], riskSensitivity: 'high', narrativeFit: 'very_high', preferredTone: ['playful', 'encouraging', 'patient', 'narrative'] },
  'B2C-CYP-03': { code: 'B2C-CYP-03', audienceType: 'B2C', name: 'KS2 Learners', description: 'Key Stage 2 students', ageRangeMin: 7, ageRangeMax: 11, ukContext: 'Year 3-6', keyNeeds: ['SATs_preparation', 'subject_depth', 'independence', 'critical_thinking'], riskSensitivity: 'high', narrativeFit: 'high', preferredTone: ['encouraging', 'narrative', 'educational', 'fun'] },
  'B2C-CYP-04': { code: 'B2C-CYP-04', audienceType: 'B2C', name: 'KS3 Students', description: 'Key Stage 3 students', ageRangeMin: 11, ageRangeMax: 14, ukContext: 'Year 7-9', keyNeeds: ['transition_support', 'study_habits', 'options_guidance', 'subject_exploration'], riskSensitivity: 'medium', narrativeFit: 'medium_high', preferredTone: ['supportive', 'respectful', 'informative'] },
  'B2C-CYP-05': { code: 'B2C-CYP-05', audienceType: 'B2C', name: 'GCSE Students', description: 'GCSE-level students', ageRangeMin: 14, ageRangeMax: 16, ukContext: 'Year 10-11', keyNeeds: ['exam_preparation', 'revision_strategies', 'stress_management', 'subject_mastery'], riskSensitivity: 'medium', narrativeFit: 'medium', preferredTone: ['professional', 'supportive', 'encouraging'] },
  'B2C-CYP-06': { code: 'B2C-CYP-06', audienceType: 'B2C', name: 'Post-16 Students', description: 'Sixth form and college students', ageRangeMin: 16, ageRangeMax: 18, ukContext: 'Sixth Form, College', keyNeeds: ['A_Levels', 'BTEC', 'UCAS_applications', 'career_exploration', 'university_preparation'], riskSensitivity: 'medium', narrativeFit: 'medium', preferredTone: ['professional', 'advisory', 'respectful'] },
  'B2C-CYP-07': { code: 'B2C-CYP-07', audienceType: 'B2C', name: 'SEND Learners', description: 'Students with special educational needs and disabilities', ageRangeMin: 3, ageRangeMax: 18, ukContext: 'All Key Stages', keyNeeds: ['accessibility', 'adaptive_pacing', 'sensory_considerations', 'individualised_support', 'patience'], riskSensitivity: 'high', narrativeFit: 'very_high', preferredTone: ['patient', 'gentle', 'clear', 'adaptive'] },
  'B2C-CYP-08': { code: 'B2C-CYP-08', audienceType: 'B2C', name: 'Home Educated', description: 'Home-schooled children', ageRangeMin: 3, ageRangeMax: 18, ukContext: 'Non-school settings', keyNeeds: ['curriculum_flexibility', 'parent_guided', 'socialisation', 'self_paced_learning'], riskSensitivity: 'medium', narrativeFit: 'very_high', preferredTone: ['flexible', 'supportive', 'educational'] },

  // --- B2C: Gatekeepers (decision makers for CYP) ---
  'B2C-GK-01': { code: 'B2C-GK-01', audienceType: 'B2C', name: 'Parents (Primary)', description: 'Primary decision makers for children', ukContext: 'Purchase decision, supervision', keyNeeds: ['child_safety', 'educational_value', 'screen_time_balance', 'progress_visibility'], riskSensitivity: 'high', narrativeFit: 'medium' },
  'B2C-GK-02': { code: 'B2C-GK-02', audienceType: 'B2C', name: 'Parents (Secondary)', description: 'Co-decision makers', ukContext: 'Co-decision, monitoring', keyNeeds: ['progress_visibility', 'cost_effectiveness', 'ease_of_use'], riskSensitivity: 'medium_high', narrativeFit: 'medium' },
  'B2C-GK-03': { code: 'B2C-GK-03', audienceType: 'B2C', name: 'Grandparents', description: 'Gift-givers and occasional supervisors', ukContext: 'Gift-giving, occasional supervision', keyNeeds: ['simplicity', 'trust', 'family_values', 'educational_benefit'], riskSensitivity: 'high', narrativeFit: 'medium' },
  'B2C-GK-04': { code: 'B2C-GK-04', audienceType: 'B2C', name: 'Carers and Guardians', description: 'Legal guardians and carers', ukContext: 'Legal responsibility', keyNeeds: ['safeguarding', 'accessibility', 'trust', 'support'], riskSensitivity: 'very_high', narrativeFit: 'high' },

  // --- B2C: Adults ---
  'B2C-ADU-01': { code: 'B2C-ADU-01', audienceType: 'B2C', name: 'Young Adults', description: 'University students and early career', ageRangeMin: 18, ageRangeMax: 25, ukContext: 'University, early career', keyNeeds: ['skills_development', 'budgeting', 'mental_health', 'career_guidance'], riskSensitivity: 'medium', narrativeFit: 'medium' },
  'B2C-ADU-02': { code: 'B2C-ADU-02', audienceType: 'B2C', name: 'Working Professionals', description: 'Career-focused adults', ageRangeMin: 25, ageRangeMax: 45, ukContext: 'Career-focused', keyNeeds: ['productivity', 'upskilling', 'work_life_balance', 'efficiency'], riskSensitivity: 'medium', narrativeFit: 'low_medium' },
  'B2C-ADU-03': { code: 'B2C-ADU-03', audienceType: 'B2C', name: 'Parents of Young Children', description: 'Family-focused parents', ageRangeMin: 25, ageRangeMax: 45, ukContext: 'Family-focused', keyNeeds: ['parenting_support', 'time_management', 'child_activities', 'family_wellbeing'], riskSensitivity: 'medium', narrativeFit: 'medium' },
  'B2C-ADU-04': { code: 'B2C-ADU-04', audienceType: 'B2C', name: 'Mid-Career Changers', description: 'Adults seeking career change', ageRangeMin: 35, ageRangeMax: 55, ukContext: 'Retraining', keyNeeds: ['new_skills', 'confidence', 'career_guidance', 'flexible_learning'], riskSensitivity: 'medium', narrativeFit: 'medium' },
  'B2C-ADU-05': { code: 'B2C-ADU-05', audienceType: 'B2C', name: 'Empty Nesters', description: 'Post-children adults', ageRangeMin: 50, ageRangeMax: 65, ukContext: 'Post-children', keyNeeds: ['hobbies', 'learning', 'health_focus', 'retirement_planning'], riskSensitivity: 'medium', narrativeFit: 'medium_high' },
  'B2C-ADU-06': { code: 'B2C-ADU-06', audienceType: 'B2C', name: 'Retirees', description: 'Retired adults', ageRangeMin: 65, ukContext: 'Retirement, leisure', keyNeeds: ['companionship', 'cognitive_engagement', 'tech_assistance', 'health_support'], riskSensitivity: 'medium_high', narrativeFit: 'high' },
  'B2C-ADU-07': { code: 'B2C-ADU-07', audienceType: 'B2C', name: 'Adult Carers', description: 'Adults caring for others', ukContext: 'Caring responsibilities', keyNeeds: ['stress_relief', 'information_access', 'respite', 'support'], riskSensitivity: 'high', narrativeFit: 'high' },
  'B2C-ADU-08': { code: 'B2C-ADU-08', audienceType: 'B2C', name: 'Neurodiverse Adults', description: 'Adults with ADHD, Autism, Dyslexia etc.', ukContext: 'Neurodiversity support', keyNeeds: ['structure', 'patience', 'non_judgment', 'adaptive_interface'], riskSensitivity: 'medium', narrativeFit: 'high' },

  // --- B2C: Interest groups ---
  'B2C-INT-01': { code: 'B2C-INT-01', audienceType: 'B2C', name: 'Hobbyists and Makers', description: 'Creative pursuits enthusiasts', ukContext: 'DIY, crafts, hobbies', keyNeeds: ['inspiration', 'guidance', 'project_support', 'community'], riskSensitivity: 'low', narrativeFit: 'high' },
  'B2C-INT-02': { code: 'B2C-INT-02', audienceType: 'B2C', name: 'Fitness Enthusiasts', description: 'Health and fitness focused', ukContext: 'Gym, sports, wellness', keyNeeds: ['motivation', 'habit_tracking', 'coaching', 'progress'], riskSensitivity: 'medium', narrativeFit: 'medium_high' },
  'B2C-INT-03': { code: 'B2C-INT-03', audienceType: 'B2C', name: 'Language Learners', description: 'Learning new languages', ukContext: 'ESOL, modern languages', keyNeeds: ['practice', 'patience', 'cultural_context', 'progression'], riskSensitivity: 'low', narrativeFit: 'very_high' },
  'B2C-INT-04': { code: 'B2C-INT-04', audienceType: 'B2C', name: 'Creative Writers', description: 'Authors and content creators', ukContext: 'Writing, blogging', keyNeeds: ['brainstorming', 'feedback', 'structure', 'inspiration'], riskSensitivity: 'low', narrativeFit: 'very_high' },
  'B2C-INT-05': { code: 'B2C-INT-05', audienceType: 'B2C', name: 'Gamers', description: 'Gaming enthusiasts', ukContext: 'Video games, tabletop', keyNeeds: ['immersion', 'lore', 'interactive_storytelling', 'entertainment'], riskSensitivity: 'low', narrativeFit: 'very_high' },
  'B2C-INT-06': { code: 'B2C-INT-06', audienceType: 'B2C', name: 'Faith Communities', description: 'Religious practice groups', ukContext: 'Religious communities', keyNeeds: ['respectful', 'values_aligned', 'supportive', 'community'], riskSensitivity: 'medium', narrativeFit: 'high' },

  // --- B2B: By organisation size ---
  'B2B-SIZE-01': { code: 'B2B-SIZE-01', audienceType: 'B2B', name: 'Solo/Freelance', description: 'One-person businesses', ukContext: '1 person', ukMarketSize: '4.2 million in UK', keyNeeds: ['efficiency', 'affordability', 'ease_of_use', 'time_saving'], decisionFactors: ['price', 'ease_of_use', 'immediate_value'], riskSensitivity: 'medium' },
  'B2B-SIZE-02': { code: 'B2B-SIZE-02', audienceType: 'B2B', name: 'Micro Business', description: 'Very small businesses', ukContext: '1-9 employees', ukMarketSize: '5.5 million in UK', keyNeeds: ['time_saving', 'multi_function', 'low_cost', 'simplicity'], decisionFactors: ['price', 'ROI', 'ease_of_implementation'], riskSensitivity: 'medium' },
  'B2B-SIZE-03': { code: 'B2B-SIZE-03', audienceType: 'B2B', name: 'Small Business', description: 'Small businesses', ukContext: '10-49 employees', ukMarketSize: '211,000 in UK', keyNeeds: ['scalability', 'team_tools', 'basic_compliance', 'integration'], decisionFactors: ['ROI', 'scalability', 'support'], riskSensitivity: 'medium_high' },
  'B2B-SIZE-04': { code: 'B2B-SIZE-04', audienceType: 'B2B', name: 'Medium Business', description: 'Medium-sized businesses', ukContext: '50-249 employees', ukMarketSize: '36,000 in UK', keyNeeds: ['integration', 'compliance', 'ROI_proof', 'customisation'], decisionFactors: ['ROI', 'compliance', 'integration', 'support_SLA'], riskSensitivity: 'high' },
  'B2B-SIZE-05': { code: 'B2B-SIZE-05', audienceType: 'B2B', name: 'Large Enterprise', description: 'Large enterprises', ukContext: '250+ employees', ukMarketSize: '7,700 in UK', keyNeeds: ['security', 'SLA', 'customisation', 'audit_trail', 'enterprise_integration'], decisionFactors: ['security', 'compliance', 'scalability', 'support', 'customisation'], riskSensitivity: 'very_high' },

  // --- B2B: By sector (UK focus) ---
  'B2B-SEC-01': { code: 'B2B-SEC-01', audienceType: 'B2B', name: 'Education (Private)', description: 'Private schools and education providers', ukContext: 'Independent schools, tutoring', ukMarketSize: '£15bn+', keyNeeds: ['tutoring', 'assessment', 'parent_communications', 'safeguarding'], riskSensitivity: 'high' },
  'B2B-SEC-02': { code: 'B2B-SEC-02', audienceType: 'B2B', name: 'EdTech Companies', description: 'Educational technology businesses', ukContext: 'EdTech sector', ukMarketSize: '£3.5bn', keyNeeds: ['white_label_AI', 'content_creation', 'platform_integration'], riskSensitivity: 'medium' },
  'B2B-SEC-03': { code: 'B2B-SEC-03', audienceType: 'B2B', name: 'Healthcare (Private)', description: 'Private healthcare providers', ukContext: 'Private hospitals, clinics', ukMarketSize: '£12bn+', keyNeeds: ['patient_education', 'wellbeing', 'appointment_support'], riskSensitivity: 'very_high' },
  'B2B-SEC-04': { code: 'B2B-SEC-04', audienceType: 'B2B', name: 'Financial Services', description: 'Banks, insurers, advisers', ukContext: 'Financial sector', ukMarketSize: 'Largest in Europe', keyNeeds: ['client_education', 'onboarding', 'compliance_training'], riskSensitivity: 'very_high' },
  'B2B-SEC-05': { code: 'B2B-SEC-05', audienceType: 'B2B', name: 'Legal Services', description: 'Law firms and legal providers', ukContext: 'Legal sector', ukMarketSize: '£37bn', keyNeeds: ['client_intake', 'document_explanation', 'compliance'], riskSensitivity: 'very_high' },
  'B2B-SEC-06': { code: 'B2B-SEC-06', audienceType: 'B2B', name: 'Retail and E-commerce', description: 'Shops and online retailers', ukContext: 'Retail sector', ukMarketSize: '£450bn+', keyNeeds: ['customer_service', 'product_guidance', 'returns_support'], riskSensitivity: 'medium' },
  'B2B-SEC-07': { code: 'B2B-SEC-07', audienceType: 'B2B', name: 'Hospitality and Tourism', description: 'Hotels, restaurants, tourism', ukContext: 'Hospitality sector', ukMarketSize: '£200bn+', keyNeeds: ['guest_experience', 'concierge', 'booking_support'], riskSensitivity: 'medium' },
  'B2B-SEC-08': { code: 'B2B-SEC-08', audienceType: 'B2B', name: 'Creative Industries', description: 'Media, design, entertainment', ukContext: 'Creative sector', ukMarketSize: '£116bn', keyNeeds: ['content_creation', 'brainstorming', 'production_support'], riskSensitivity: 'low' },
  'B2B-SEC-09': { code: 'B2B-SEC-09', audienceType: 'B2B', name: 'Professional Services', description: 'Consulting, accounting', ukContext: 'Professional services', ukMarketSize: '£190bn', keyNeeds: ['knowledge_management', 'client_communications', 'research'], riskSensitivity: 'high' },
  'B2B-SEC-10': { code: 'B2B-SEC-10', audienceType: 'B2B', name: 'Manufacturing', description: 'Manufacturing businesses', ukContext: 'Manufacturing sector', ukMarketSize: '£191bn', keyNeeds: ['training', 'procedures', 'safety', 'quality'], riskSensitivity: 'high' },
  'B2B-SEC-11': { code: 'B2B-SEC-11', audienceType: 'B2B', name: 'Charities and Social Enterprise', description: 'Third sector organisations', ukContext: 'Charity sector', ukMarketSize: '£53bn', keyNeeds: ['donor_engagement', 'beneficiary_support', 'cost_efficiency'], riskSensitivity: 'medium' },
  'B2B-SEC-12': { code: 'B2B-SEC-12', audienceType: 'B2B', name: 'HR and Recruitment', description: 'HR services and recruiters', ukContext: 'HR/Recruitment', ukMarketSize: '£42bn', keyNeeds: ['candidate_experience', 'onboarding', 'compliance'], riskSensitivity: 'medium_high' },

  // --- B2B: By function ---
  'B2B-FUN-01': { code: 'B2B-FUN-01', audienceType: 'B2B', name: 'Learning and Development', description: 'L&D managers and trainers', ukContext: 'Corporate training', keyNeeds: ['training_narratives', 'onboarding', 'skills_development'], decisionFactors: ['learning_outcomes', 'engagement', 'scalability'], riskSensitivity: 'medium' },
  'B2B-FUN-02': { code: 'B2B-FUN-02', audienceType: 'B2B', name: 'Customer Success', description: 'CS teams and managers', ukContext: 'Client retention', keyNeeds: ['client_education', 'retention', 'support_automation'], decisionFactors: ['customer_satisfaction', 'efficiency', 'scalability'], riskSensitivity: 'medium' },
  'B2B-FUN-03': { code: 'B2B-FUN-03', audienceType: 'B2B', name: 'Marketing', description: 'Marketing teams', ukContext: 'Brand and demand', keyNeeds: ['brand_storytelling', 'content_creation', 'campaigns'], decisionFactors: ['brand_consistency', 'efficiency', 'creativity'], riskSensitivity: 'medium' },
  'B2B-FUN-04': { code: 'B2B-FUN-04', audienceType: 'B2B', name: 'Sales', description: 'Sales teams', ukContext: 'Revenue generation', keyNeeds: ['discovery_conversations', 'demos', 'proposals'], decisionFactors: ['conversion', 'efficiency', 'personalisation'], riskSensitivity: 'medium' },
  'B2B-FUN-05': { code: 'B2B-FUN-05', audienceType: 'B2B', name: 'HR Operations', description: 'HR teams', ukContext: 'People management', keyNeeds: ['employee_QA', 'policy_guidance', 'onboarding'], decisionFactors: ['compliance', 'employee_experience', 'efficiency'], riskSensitivity: 'medium' },
  'B2B-FUN-06': { code: 'B2B-FUN-06', audienceType: 'B2B', name: 'Internal Communications', description: 'Comms managers', ukContext: 'Employee engagement', keyNeeds: ['engagement', 'culture', 'information_distribution'], decisionFactors: ['reach', 'engagement', 'consistency'], riskSensitivity: 'medium' },

  // --- B2G: Central government ---
  'B2G-CEN-01': { code: 'B2G-CEN-01', audienceType: 'B2G', name: 'Ministerial Departments', description: 'Central government departments', ukContext: 'DfE, DHSC, DWP, HMRC etc.', keyNeeds: ['citizen_guidance', 'policy_explanation', 'service_delivery'], riskSensitivity: 'critical' },
  'B2G-CEN-02': { code: 'B2G-CEN-02', audienceType: 'B2G', name: 'Executive Agencies', description: 'Government executive agencies', ukContext: 'DVLA, Ofsted, UKVI etc.', keyNeeds: ['service_navigation', 'form_assistance', 'information_provision'], riskSensitivity: 'critical' },
  'B2G-CEN-03': { code: 'B2G-CEN-03', audienceType: 'B2G', name: 'Non-Departmental Bodies', description: "NDPBs and arm's length bodies", ukContext: 'Arts Council, British Council', keyNeeds: ['programme_information', 'application_support', 'engagement'], riskSensitivity: 'high' },
  'B2G-CEN-04': { code: 'B2G-CEN-04', audienceType: 'B2G', name: 'NHS Bodies', description: 'NHS England and related bodies', ukContext: 'NHS England, CQC', keyNeeds: ['health_education', 'regulatory_guidance', 'service_information'], riskSensitivity: 'critical' },

  // --- B2G: Local government ---
  'B2G-LOC-01': { code: 'B2G-LOC-01', audienceType: 'B2G', name: 'County Councils', description: 'County councils', ukContext: 'County level services', ukMarketSize: '21 councils', keyNeeds: ['service_signposting', 'social_care_info', 'transport'], riskSensitivity: 'high' },
  'B2G-LOC-02': { code: 'B2G-LOC-02', audienceType: 'B2G', name: 'District Councils', description: 'District councils', ukContext: 'District level services', ukMarketSize: '181 councils', keyNeeds: ['housing', 'planning', 'council_tax', 'waste'], riskSensitivity: 'high' },
  'B2G-LOC-03': { code: 'B2G-LOC-03', audienceType: 'B2G', name: 'Unitary Authorities', description: 'Unitary authorities', ukContext: 'Single-tier councils', ukMarketSize: '59 authorities', keyNeeds: ['full_service_guidance', 'integrated_support'], riskSensitivity: 'high' },
  'B2G-LOC-04': { code: 'B2G-LOC-04', audienceType: 'B2G', name: 'Metropolitan Boroughs', description: 'Metropolitan borough councils', ukContext: 'Urban areas', ukMarketSize: '36 boroughs', keyNeeds: ['urban_services', 'transport', 'integrated_services'], riskSensitivity: 'high' },
  'B2G-LOC-05': { code: 'B2G-LOC-05', audienceType: 'B2G', name: 'London Boroughs', description: 'London borough councils', ukContext: 'Greater London', ukMarketSize: '32 boroughs + City', keyNeeds: ['complex_services', 'high_volume', 'multilingual'], riskSensitivity: 'high' },
  'B2G-LOC-06': { code: 'B2G-LOC-06', audienceType: 'B2G', name: 'Parish/Town Councils', description: 'Parish and town councils', ukContext: 'Local community', ukMarketSize: '10,000+ councils', keyNeeds: ['community_info', 'local_events', 'basic_services'], riskSensitivity: 'medium' },
  'B2G-LOC-07': { code: 'B2G-LOC-07', audienceType: 'B2G', name: 'Combined Authorities', description: 'Combined authorities and mayors', ukContext: 'Regional coordination', ukMarketSize: '10 authorities', keyNeeds: ['regional_coordination', 'transport', 'strategic_planning'], riskSensitivity: 'high' },

  // --- B2G: Public services ---
  'B2G-PUB-01': { code: 'B2G-PUB-01', audienceType: 'B2G', name: 'State Schools (Maintained)', description: 'Local authority maintained schools', ukContext: 'Primary and secondary', ukMarketSize: '20,000+ schools', keyNeeds: ['curriculum_support', 'parent_comms', 'SEND_support', 'safeguarding'], riskSensitivity: 'high' },
  'B2G-PUB-02': { code: 'B2G-PUB-02', audienceType: 'B2G', name: 'Academy Trusts', description: 'Multi-academy trusts', ukContext: 'Academies', ukMarketSize: '1,100+ trusts', keyNeeds: ['standardised_training', 'student_support', 'governance'], riskSensitivity: 'high' },
  'B2G-PUB-03': { code: 'B2G-PUB-03', audienceType: 'B2G', name: 'FE Colleges', description: 'Further education colleges', ukContext: 'Post-16 education', ukMarketSize: '230+ colleges', keyNeeds: ['student_services', 'course_guidance', 'employability'], riskSensitivity: 'medium_high' },
  'B2G-PUB-04': { code: 'B2G-PUB-04', audienceType: 'B2G', name: 'Universities', description: 'Higher education institutions', ukContext: 'Higher education', ukMarketSize: '130+ HEIs', keyNeeds: ['student_support', 'research_comms', 'accessibility'], riskSensitivity: 'medium_high' },
  'B2G-PUB-05': { code: 'B2G-PUB-05', audienceType: 'B2G', name: 'Public Libraries', description: 'Library services', ukContext: 'Community access', ukMarketSize: '3,000+ libraries', keyNeeds: ['literacy', 'digital_inclusion', 'community_support'], riskSensitivity: 'medium' },
  'B2G-PUB-06': { code: 'B2G-PUB-06', audienceType: 'B2G', name: 'NHS Trusts', description: 'NHS provider trusts', ukContext: 'Healthcare delivery', ukMarketSize: '220+ trusts', keyNeeds: ['patient_education', 'navigation', 'appointment_support'], riskSensitivity: 'critical' },
  'B2G-PUB-07': { code: 'B2G-PUB-07', audienceType: 'B2G', name: 'Police Forces', description: 'Territorial police forces', ukContext: 'Law enforcement', ukMarketSize: '43 forces', keyNeeds: ['community_engagement', 'information', 'non_emergency'], riskSensitivity: 'high' },
  'B2G-PUB-08': { code: 'B2G-PUB-08', audienceType: 'B2G', name: 'Fire and Rescue', description: 'Fire and rescue services', ukContext: 'Emergency services', ukMarketSize: '45 services', keyNeeds: ['safety_education', 'prevention', 'community'], riskSensitivity: 'medium_high' },
  'B2G-PUB-09': { code: 'B2G-PUB-09', audienceType: 'B2G', name: 'Museums and Galleries', description: 'Public museums and galleries', ukContext: 'Cultural institutions', ukMarketSize: '2,500+', keyNeeds: ['educational_narratives', 'accessibility', 'engagement'], riskSensitivity: 'medium' },
  'B2G-PUB-10': { code: 'B2G-PUB-10', audienceType: 'B2G', name: 'Housing Associations', description: 'Registered social landlords', ukContext: 'Social housing', ukMarketSize: '1,500+ HAs', keyNeeds: ['tenant_support', 'service_navigation', 'repairs'], riskSensitivity: 'medium_high' },
};

export function isAudienceSegmentCode(value: string): value is keyof typeof AUDIENCE_SEGMENTS {
  return value in AUDIENCE_SEGMENTS;
}

export function segmentsForAudienceType(type: 'B2C' | 'B2B' | 'B2G'): AudienceSegmentConfig[] {
  return Object.values(AUDIENCE_SEGMENTS).filter((s) => s.audienceType === type);
}
