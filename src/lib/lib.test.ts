import { describe, expect, it } from 'vitest'
import { numberToFrench, phrase } from './money'
import { ageRevolu, categorieDe, parseFrDate } from './age'
import { suggestOperator, toE164, isValidMobile } from './phone'
import { CATEGORIES } from '../data/catalog'

describe('T9 — montant en lettres', () => {
  it('accorde correctement', () => {
    expect(numberToFrench(80000)).toBe('quatre-vingt mille')
    expect(numberToFrench(200)).toBe('deux cents')
    expect(numberToFrench(21000)).toBe('vingt et un mille')
    expect(numberToFrench(80)).toBe('quatre-vingts')
    expect(numberToFrench(1000)).toBe('mille')
    expect(numberToFrench(200000)).toBe('deux cent mille')
    expect(numberToFrench(71)).toBe('soixante et onze')
    expect(numberToFrench(91)).toBe('quatre-vingt-onze')
    expect(numberToFrench(1_250_000)).toBe('un million deux cent cinquante mille')
    expect(phrase(45000)).toContain('quarante-cinq mille francs CFA')
  })
})

describe('T1/T2 — catégories VOGT Sport', () => {
  it('né le 14/03/2015, session 05/07/2027 : 12 ans, U13', () => {
    const age = ageRevolu(parseFrDate('14/03/2015')!, '2027-07-05')
    expect(age).toBe(12)
    expect(categorieDe(age, CATEGORIES)?.code).toBe('U13')
  })
  it('4 ans refusé', () => {
    const age = ageRevolu(parseFrDate('01/01/2023')!, '2027-07-05')
    expect(age).toBe(4)
    expect(categorieDe(age, CATEGORIES)).toBeNull()
  })
  it('bornes du tableau', () => {
    expect(ageRevolu(parseFrDate('06/07/2020')!, '2027-07-05')).toBe(6)
    expect(ageRevolu(parseFrDate('05/07/2022')!, '2027-07-05')).toBe(5)
  })
  it('rejette les dates inexistantes', () => {
    expect(parseFrDate('31/02/2015')).toBeNull()
  })
})

describe('téléphone', () => {
  it('E.164 et opérateur', () => {
    expect(toE164('6 77 12 34 56')).toBe('+237677123456')
    expect(isValidMobile('577123456')).toBe(false)
    expect(suggestOperator('677123456')).toBe('MTN')
    expect(suggestOperator('699123456')).toBe('ORANGE')
  })
})
