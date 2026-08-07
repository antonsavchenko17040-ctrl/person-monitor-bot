import * as fileStore from "./store-file.js";
import * as neonStore from "./store-neon.js";

function activeStore() {
  return process.env.DATABASE_URL?.trim()
    ? neonStore
    : fileStore;
}

export function readData(...args) {
  return activeStore().readData(...args);
}

export function upsertUser(...args) {
  return activeStore().upsertUser(...args);
}

export function createSubject(...args) {
  return activeStore().createSubject(...args);
}

export function listSubjects(...args) {
  return activeStore().listSubjects(...args);
}

export function getSubject(...args) {
  return activeStore().getSubject(...args);
}

export function deleteSubject(...args) {
  return activeStore().deleteSubject(...args);
}

export function addAlias(...args) {
  return activeStore().addAlias(...args);
}

export function addExcludedTerm(...args) {
  return activeStore().addExcludedTerm(...args);
}

export function updateSubject(...args) {
  return activeStore().updateSubject(...args);
}

export function markSubjectChecked(...args) {
  return activeStore().markSubjectChecked(...args);
}

export function saveMention(...args) {
  return activeStore().saveMention(...args);
}

export function listMentions(...args) {
  return activeStore().listMentions(...args);
}
