use crate::entities::FontNameEntry;
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};
use ttf_parser::{name::Name, name_id, Face};

#[derive(Clone, Copy)]
enum NamePreference {
    Canonical,
    Display,
}

#[derive(Clone)]
struct ParsedFontMetadata {
    family: String,
    display_family: String,
    subfamily: Option<String>,
    full_name: Option<String>,
    postscript_name: Option<String>,
    family_aliases: Vec<String>,
}

struct NameCandidate {
    value: String,
    score: i32,
}

pub fn load_system_fonts() -> Vec<FontNameEntry> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();

    let mut results = Vec::new();

    for face in db.faces() {
        let path_buf = get_face_path(&face.source);
        let path = path_buf
            .as_ref()
            .map(|path| path.to_string_lossy().to_string());
        let parsed = path_buf
            .as_deref()
            .and_then(|font_path| parse_font_metadata(font_path, face.index));

        let fallback_family = pick_family_alias(&face.families, NamePreference::Canonical)
            .unwrap_or_else(|| "Unknown".to_string());
        let display_family = parsed
            .as_ref()
            .map(|metadata| metadata.display_family.clone())
            .or_else(|| pick_family_alias(&face.families, NamePreference::Display))
            .unwrap_or_else(|| fallback_family.clone());
        let family = parsed
            .as_ref()
            .map(|metadata| metadata.family.clone())
            .unwrap_or_else(|| fallback_family.clone());
        let family_aliases = parsed
            .as_ref()
            .map(|metadata| metadata.family_aliases.clone())
            .unwrap_or_else(|| collect_face_family_aliases(&face.families));

        results.push(FontNameEntry {
            family,
            display_family,
            subfamily: parsed
                .as_ref()
                .and_then(|metadata| metadata.subfamily.clone()),
            full_name: parsed.as_ref().and_then(|metadata| metadata.full_name.clone()),
            postscript_name: parsed
                .as_ref()
                .and_then(|metadata| metadata.postscript_name.clone())
                .or_else(|| Some(face.post_script_name.clone())),
            weight: Some(face.weight.0),
            path,
            face_index: face.index,
            family_aliases,
        });
    }

    let mut seen = HashSet::new();
    results
        .into_iter()
        .filter(|entry| seen.insert(build_font_identity_key(entry)))
        .collect()
}

fn get_face_path(source: &fontdb::Source) -> Option<PathBuf> {
    match source {
        fontdb::Source::File(path) => Some(path.clone()),
        fontdb::Source::SharedFile(path, _) => Some(path.clone()),
        _ => None,
    }
}

fn parse_font_metadata(path: &Path, face_index: u32) -> Option<ParsedFontMetadata> {
    let data = fs::read(path).ok()?;
    let face = Face::parse(&data, face_index).ok()?;

    let family = select_name_value(
        &face,
        &[name_id::TYPOGRAPHIC_FAMILY, name_id::FAMILY],
        NamePreference::Canonical,
    )?;
    let display_family = select_name_value(
        &face,
        &[name_id::TYPOGRAPHIC_FAMILY, name_id::FAMILY],
        NamePreference::Display,
    )
    .unwrap_or_else(|| family.clone());

    let subfamily = select_name_value(
        &face,
        &[name_id::TYPOGRAPHIC_SUBFAMILY, name_id::SUBFAMILY],
        NamePreference::Canonical,
    );
    let full_name = select_name_value(&face, &[name_id::FULL_NAME], NamePreference::Display)
        .or_else(|| select_name_value(&face, &[name_id::FULL_NAME], NamePreference::Canonical));
    let postscript_name =
        select_name_value(&face, &[name_id::POST_SCRIPT_NAME], NamePreference::Canonical);
    let family_aliases = collect_family_aliases_from_face(&face);

    Some(ParsedFontMetadata {
        family,
        display_family,
        subfamily,
        full_name,
        postscript_name,
        family_aliases,
    })
}

fn select_name_value(face: &Face, ids: &[u16], preference: NamePreference) -> Option<String> {
    ids.iter().find_map(|name_id| {
        face.names()
            .into_iter()
            .filter(|name| name.name_id == *name_id && name.is_unicode())
            .filter_map(|name| {
                let value = normalize_name_value(name.to_string())?;
                let score = score_name_candidate(&name, preference);
                Some(NameCandidate { value, score })
            })
            .max_by_key(|candidate| candidate.score)
            .map(|candidate| candidate.value)
    })
}

fn collect_family_aliases_from_face(face: &Face) -> Vec<String> {
    let mut aliases = Vec::new();
    let mut seen = HashSet::new();

    for name in face.names() {
        if !name.is_unicode() {
            continue;
        }

        if !matches!(name.name_id, name_id::TYPOGRAPHIC_FAMILY | name_id::FAMILY) {
            continue;
        }

        let Some(value) = normalize_name_value(name.to_string()) else {
            continue;
        };

        let normalized_key = value.to_lowercase();
        if seen.insert(normalized_key) {
            aliases.push(value);
        }
    }

    aliases
}

fn pick_family_alias(
    families: &[(String, ttf_parser::Language)],
    preference: NamePreference,
) -> Option<String> {
    families
        .iter()
        .filter_map(|(name, language)| {
            let value = normalize_name_value(Some(name.clone()))?;
            let score = score_language(language.primary_language(), language.region(), preference);
            Some(NameCandidate { value, score })
        })
        .max_by_key(|candidate| candidate.score)
        .map(|candidate| candidate.value)
}

fn collect_face_family_aliases(families: &[(String, ttf_parser::Language)]) -> Vec<String> {
    let mut aliases = Vec::new();
    let mut seen = HashSet::new();

    for (name, _) in families {
        let Some(value) = normalize_name_value(Some(name.clone())) else {
            continue;
        };

        if seen.insert(value.to_lowercase()) {
            aliases.push(value);
        }
    }

    aliases
}

fn normalize_name_value(value: Option<String>) -> Option<String> {
    let value = value?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(trimmed.to_string())
}

fn score_name_candidate(name: &Name, preference: NamePreference) -> i32 {
    let language = name.language();
    score_language(language.primary_language(), language.region(), preference)
}

fn score_language(primary_language: &str, region: &str, preference: NamePreference) -> i32 {
    let is_chinese = primary_language.eq_ignore_ascii_case("Chinese");
    let is_english = primary_language.eq_ignore_ascii_case("English");
    let is_simplified_chinese = is_chinese
        && matches!(
            region,
            "China" | "Singapore" | "China, Macao S.A.R." | "China, Hong Kong S.A.R."
        );

    match preference {
        NamePreference::Canonical => {
            if is_english {
                300
            } else if is_chinese {
                if is_simplified_chinese { 200 } else { 180 }
            } else {
                100
            }
        }
        NamePreference::Display => {
            if is_simplified_chinese {
                320
            } else if is_chinese {
                260
            } else if is_english {
                180
            } else {
                100
            }
        }
    }
}

fn build_font_identity_key(entry: &FontNameEntry) -> String {
    let path = entry.path.as_deref().unwrap_or_default();

    if let Some(postscript_name) = &entry.postscript_name {
        return format!(
            "ps|{}|{}|{}",
            postscript_name.trim().to_lowercase(),
            path.to_lowercase(),
            entry.face_index
        );
    }

    if let Some(full_name) = &entry.full_name {
        return format!(
            "full|{}|{}|{}|{}",
            full_name.trim().to_lowercase(),
            entry.weight.unwrap_or_default(),
            path.to_lowercase(),
            entry.face_index
        );
    }

    format!(
        "family|{}|{}|{}|{}",
        entry.family.trim().to_lowercase(),
        entry.weight.unwrap_or_default(),
        path.to_lowercase(),
        entry.face_index
    )
}
