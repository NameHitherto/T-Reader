import { invoke } from '@tauri-apps/api/core'
import type { TxtTocRule } from '@/services/book/types'
import {
  buildLocalFilePath,
  LOCAL_DIRS,
  localPathExists,
  readJsonFile,
  writeJsonFile,
} from '@/services/fs'

export type { TxtTocRule }

const TXT_TOC_RULE_FILE = 'txtTocRule.json'

const getTxtTocRulesPath = (): string => {
  return buildLocalFilePath(LOCAL_DIRS.system, TXT_TOC_RULE_FILE)
}

const normalizeTxtTocRule = (rule: Partial<TxtTocRule>): TxtTocRule => {
  return {
    enable: rule.enable !== false,
    example: typeof rule.example === 'string' ? rule.example : '',
    id: typeof rule.id === 'number' ? rule.id : 0,
    name: typeof rule.name === 'string' ? rule.name : '',
    rule: typeof rule.rule === 'string' ? rule.rule : '',
    serialNumber: typeof rule.serialNumber === 'number' ? rule.serialNumber : 0,
  }
}

const sortTxtTocRules = (rules: TxtTocRule[]): TxtTocRule[] => {
  return [...rules].sort((a, b) => a.serialNumber - b.serialNumber)
}

const ensureTxtTocRulesFile = async (): Promise<void> => {
  const ruleFilePath = getTxtTocRulesPath()
  if (await localPathExists(ruleFilePath)) {
    return
  }

  await invoke('ensure_txt_toc_rules_file')
}

export const resequenceTxtTocRules = (rules: TxtTocRule[]): TxtTocRule[] => {
  return rules.map((rule, index) => ({
    ...rule,
    serialNumber: index,
  }))
}

export const loadTxtTocRules = async (): Promise<TxtTocRule[]> => {
  await ensureTxtTocRulesFile()
  const rules = await readJsonFile<Partial<TxtTocRule>[]>(getTxtTocRulesPath())

  return sortTxtTocRules(rules.map(normalizeTxtTocRule))
}

export const saveTxtTocRules = async (rules: TxtTocRule[]): Promise<void> => {
  await writeJsonFile(getTxtTocRulesPath(), resequenceTxtTocRules(rules))
}
