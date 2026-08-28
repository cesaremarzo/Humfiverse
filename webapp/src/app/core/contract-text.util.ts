import { ContractClause, ContractTemplate, Locale } from './models';

export function vessatoriaClauseIds(template: ContractTemplate): string[] {
  return template.clauses.filter((c) => c.vessatoria).map((c) => c.id);
}

export function clauseText(template: ContractTemplate, clause: ContractClause, field: 'title' | 'body', locale: Locale): string {
  const authLoc = template.authoritativeLanguage || 'it';
  return clause.i18n[locale]?.[field] || clause.i18n[authLoc]?.[field] || '';
}

export function clauseCategory(clause: ContractClause, locale: Locale, authLoc: Locale): string {
  if (!clause.vessatoriaCategory) return '';
  return clause.vessatoriaCategory[locale] || clause.vessatoriaCategory[authLoc] || '';
}

export function contractLegalBasisNote(template: ContractTemplate, locale: Locale): string {
  const note = template.legalBasisNote;
  if (!note) return '';
  const authLoc = template.authoritativeLanguage || 'it';
  return note[locale] || note[authLoc] || '';
}
