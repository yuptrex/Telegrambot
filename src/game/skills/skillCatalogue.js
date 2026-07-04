const SKILLS_BY_CLASS = require('../../config/skills');

/** Flat map of skillId -> skill definition (with className attached), across all classes. */
const FLAT_SKILLS = {};
for (const [className, list] of Object.entries(SKILLS_BY_CLASS)) {
  for (const skill of list) {
    FLAT_SKILLS[skill.id] = { ...skill, className };
  }
}

function getSkill(skillId) {
  return FLAT_SKILLS[skillId] || null;
}

function getSkillsForClass(className) {
  return SKILLS_BY_CLASS[className] || [];
}

module.exports = { ...SKILLS_BY_CLASS, getSkill, getSkillsForClass, FLAT_SKILLS };
