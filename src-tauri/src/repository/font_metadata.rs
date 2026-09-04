use crate::entities::FontNameEntry;
use std::collections::HashSet;
use ttf_parser::{Face, Language, name::Name, name_id};

const COLLECTION_HEADER_LEN: usize = 12;
const COLLECTION_OFFSET_LEN: usize = 4;
const SFNT_HEADER_LEN: usize = 12;
const MAX_COLLECTION_FACES: u32 = 4096;

#[derive(Clone, Copy)]
pub(crate) enum NamePreference {
    Canonical,
    Display,
}

#[derive(Clone)]
pub(crate) struct ParsedFontMetadata {
    pub(crate) family: String,
    pub(crate) display_family: String,
    pub(crate) subfamily: Option<String>,
    pub(crate) full_name: Option<String>,
    pub(crate) postscript_name: Option<String>,
    pub(crate) family_aliases: Vec<String>,
}

struct NameCandidate {
    value: String,
    score: i32,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SfntKind {
    TrueType,
    OpenType,
}

impl SfntKind {
    fn extension(self) -> &'static str {
        match self {
            Self::TrueType => "ttf",
            Self::OpenType => "otf",
        }
    }
}

pub(crate) fn parse_face_metadata(face: &Face<'_>) -> Option<ParsedFontMetadata> {
    let family = select_name_value(
        face,
        &[name_id::TYPOGRAPHIC_FAMILY, name_id::FAMILY],
        NamePreference::Canonical,
    )?;
    let display_family = select_name_value(
        face,
        &[name_id::TYPOGRAPHIC_FAMILY, name_id::FAMILY],
        NamePreference::Display,
    )
    .unwrap_or_else(|| family.clone());

    let subfamily = select_name_value(
        face,
        &[name_id::TYPOGRAPHIC_SUBFAMILY, name_id::SUBFAMILY],
        NamePreference::Canonical,
    );
    let full_name = select_name_value(face, &[name_id::FULL_NAME], NamePreference::Display)
        .or_else(|| select_name_value(face, &[name_id::FULL_NAME], NamePreference::Canonical));
    let postscript_name = select_name_value(
        face,
        &[name_id::POST_SCRIPT_NAME],
        NamePreference::Canonical,
    );
    let family_aliases = collect_family_aliases_from_face(face);

    Some(ParsedFontMetadata {
        family,
        display_family,
        subfamily,
        full_name,
        postscript_name,
        family_aliases,
    })
}

pub(crate) fn pick_family_alias(
    families: &[(String, Language)],
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

pub(crate) fn collect_face_family_aliases(families: &[(String, Language)]) -> Vec<String> {
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

pub fn parse_font_data(data: &[u8]) -> Result<(&'static str, Vec<FontNameEntry>), String> {
    let (extension, face_count) = match sfnt_kind(data) {
        Some(kind) => (kind.extension(), 1),
        None if data.get(..4).is_some_and(|magic| magic == b"ttcf") => {
            parse_collection_header(data)?
        }
        None => return Err("不支持的字体签名".to_string()),
    };

    let face_count_usize =
        usize::try_from(face_count).map_err(|_| "字体面数量超出当前平台支持范围".to_string())?;
    let mut entries = Vec::new();
    entries
        .try_reserve_exact(face_count_usize)
        .map_err(|_| "字体面数量过大".to_string())?;

    for face_index in 0..face_count {
        let face = Face::parse(data, face_index)
            .map_err(|error| format!("字体面 {face_index} 无效: {error}"))?;
        let metadata = parse_face_metadata(&face)
            .ok_or_else(|| format!("字体面 {face_index} 缺少有效的家族名称"))?;

        entries.push(FontNameEntry {
            family: metadata.family,
            display_family: metadata.display_family,
            subfamily: metadata.subfamily,
            full_name: metadata.full_name,
            postscript_name: metadata.postscript_name,
            weight: Some(face.weight().to_number()),
            path: None,
            face_index,
            family_aliases: metadata.family_aliases,
        });
    }

    Ok((extension, entries))
}

fn sfnt_kind(data: &[u8]) -> Option<SfntKind> {
    match data.get(..4)? {
        [0, 1, 0, 0] | b"true" => Some(SfntKind::TrueType),
        b"OTTO" => Some(SfntKind::OpenType),
        _ => None,
    }
}

fn parse_collection_header(data: &[u8]) -> Result<(&'static str, u32), String> {
    if data.len() < COLLECTION_HEADER_LEN {
        return Err("字体集合头不完整".to_string());
    }

    let version = read_u32(data, 4).ok_or_else(|| "字体集合版本缺失".to_string())?;
    if !matches!(version, 0x0001_0000 | 0x0002_0000) {
        return Err("不支持的字体集合版本".to_string());
    }

    let face_count = read_u32(data, 8).ok_or_else(|| "字体集合面数量缺失".to_string())?;
    if face_count == 0 {
        return Err("字体集合不包含字体面".to_string());
    }
    if face_count > MAX_COLLECTION_FACES {
        return Err("字体集合面数量过大".to_string());
    }

    let face_count_usize = usize::try_from(face_count)
        .map_err(|_| "字体集合面数量超出当前平台支持范围".to_string())?;
    let offsets_len = face_count_usize
        .checked_mul(COLLECTION_OFFSET_LEN)
        .ok_or_else(|| "字体集合偏移表过大".to_string())?;
    let offsets_end = COLLECTION_HEADER_LEN
        .checked_add(offsets_len)
        .ok_or_else(|| "字体集合偏移表过大".to_string())?;
    if offsets_end > data.len() {
        return Err("字体集合偏移表超出文件范围".to_string());
    }

    let minimum_faces_end = offsets_end
        .checked_add(
            face_count_usize
                .checked_mul(SFNT_HEADER_LEN)
                .ok_or_else(|| "字体集合面数量过大".to_string())?,
        )
        .ok_or_else(|| "字体集合面数量过大".to_string())?;
    if minimum_faces_end > data.len() {
        return Err("字体集合没有足够的字体面头空间".to_string());
    }

    let mut has_open_type_face = false;
    for face_index in 0..face_count_usize {
        let offset_position = COLLECTION_HEADER_LEN + face_index * COLLECTION_OFFSET_LEN;
        let face_offset = usize::try_from(
            read_u32(data, offset_position)
                .ok_or_else(|| format!("字体集合面 {face_index} 的偏移缺失"))?,
        )
        .map_err(|_| format!("字体集合面 {face_index} 的偏移无效"))?;

        let face_end = face_offset
            .checked_add(SFNT_HEADER_LEN)
            .ok_or_else(|| format!("字体集合面 {face_index} 的偏移溢出"))?;
        if face_offset < offsets_end || face_end > data.len() || face_offset % 4 != 0 {
            return Err(format!("字体集合面 {face_index} 的偏移无效"));
        }

        let kind = sfnt_kind(
            data.get(face_offset..face_offset + COLLECTION_OFFSET_LEN)
                .ok_or_else(|| format!("字体集合面 {face_index} 的签名缺失"))?,
        )
        .ok_or_else(|| format!("字体集合面 {face_index} 的签名不受支持"))?;

        if kind == SfntKind::OpenType {
            has_open_type_face = true;
        }
    }

    let extension = if has_open_type_face { "otc" } else { "ttc" };
    Ok((extension, face_count))
}

fn read_u32(data: &[u8], offset: usize) -> Option<u32> {
    let bytes = data.get(offset..offset.checked_add(4)?)?;
    Some(u32::from_be_bytes(bytes.try_into().ok()?))
}

fn select_name_value(face: &Face<'_>, ids: &[u16], preference: NamePreference) -> Option<String> {
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

fn collect_family_aliases_from_face(face: &Face<'_>) -> Vec<String> {
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

fn score_name_candidate(name: &Name<'_>, preference: NamePreference) -> i32 {
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

#[cfg(test)]
pub(crate) mod test_support {
    use super::*;

    struct TestName {
        name_id: u16,
        language_id: u16,
        value: &'static str,
    }

    struct TestTable {
        tag: [u8; 4],
        data: Vec<u8>,
    }

    struct TestFace {
        signature: [u8; 4],
        tables: Vec<TestTable>,
    }

    pub fn font_bytes(weight: u16) -> Vec<u8> {
        serialize_face(test_face(weight), 0)
    }

    pub fn collection_bytes() -> Vec<u8> {
        let faces = [test_face(400), test_face(700)];
        let header_len = COLLECTION_HEADER_LEN + faces.len() * COLLECTION_OFFSET_LEN;
        let mut serialized_faces = Vec::with_capacity(faces.len());
        let mut next_offset = header_len;

        for face in faces {
            let bytes = serialize_face(face, next_offset);
            next_offset += bytes.len();
            serialized_faces.push(bytes);
        }

        let mut data = Vec::with_capacity(next_offset);
        data.extend_from_slice(b"ttcf");
        push_u32(&mut data, 0x0001_0000);
        push_u32(&mut data, serialized_faces.len() as u32);

        let mut offset = header_len;
        for face in &serialized_faces {
            push_u32(&mut data, offset as u32);
            offset += face.len();
        }
        for face in serialized_faces {
            data.extend_from_slice(&face);
        }

        data
    }

    fn test_face(weight: u16) -> TestFace {
        let bold = weight >= 700;
        let subfamily = if bold { "Bold" } else { "Regular" };
        let full_name_english = if bold {
            "Test Font Bold"
        } else {
            "Test Font Regular"
        };
        let full_name_chinese = if bold {
            "测试字体 粗体"
        } else {
            "测试字体 常规"
        };
        let postscript_name = if bold {
            "TestFont-Bold"
        } else {
            "TestFont-Regular"
        };

        TestFace {
            signature: *b"\x00\x01\x00\x00",
            tables: vec![
                TestTable {
                    tag: *b"OS/2",
                    data: os2_table(weight),
                },
                TestTable {
                    tag: *b"head",
                    data: head_table(),
                },
                TestTable {
                    tag: *b"hhea",
                    data: hhea_table(),
                },
                TestTable {
                    tag: *b"maxp",
                    data: maxp_table(),
                },
                TestTable {
                    tag: *b"name",
                    data: name_table(&[
                        TestName {
                            name_id: name_id::FAMILY,
                            language_id: 0x0409,
                            value: "Test Font",
                        },
                        TestName {
                            name_id: name_id::FAMILY,
                            language_id: 0x0804,
                            value: "测试字体",
                        },
                        TestName {
                            name_id: name_id::SUBFAMILY,
                            language_id: 0x0409,
                            value: subfamily,
                        },
                        TestName {
                            name_id: name_id::SUBFAMILY,
                            language_id: 0x0804,
                            value: if bold { "粗体" } else { "常规" },
                        },
                        TestName {
                            name_id: name_id::FULL_NAME,
                            language_id: 0x0409,
                            value: full_name_english,
                        },
                        TestName {
                            name_id: name_id::FULL_NAME,
                            language_id: 0x0804,
                            value: full_name_chinese,
                        },
                        TestName {
                            name_id: name_id::POST_SCRIPT_NAME,
                            language_id: 0x0409,
                            value: postscript_name,
                        },
                    ]),
                },
            ],
        }
    }

    fn serialize_face(face: TestFace, base_offset: usize) -> Vec<u8> {
        let table_data_start = SFNT_HEADER_LEN + face.tables.len() * 16;
        let mut table_offsets = Vec::with_capacity(face.tables.len());
        let mut next_offset = table_data_start;

        for table in &face.tables {
            next_offset = align4(next_offset);
            table_offsets.push(next_offset);
            next_offset += table.data.len();
        }

        let mut data = Vec::with_capacity(next_offset);
        data.extend_from_slice(&face.signature);
        push_u16(&mut data, face.tables.len() as u16);
        push_u16(&mut data, 0);
        push_u16(&mut data, 0);
        push_u16(&mut data, 0);

        for (table, offset) in face.tables.iter().zip(table_offsets) {
            data.extend_from_slice(&table.tag);
            push_u32(&mut data, 0);
            push_u32(&mut data, (base_offset + offset) as u32);
            push_u32(&mut data, table.data.len() as u32);
        }

        for table in face.tables {
            while data.len() % 4 != 0 {
                data.push(0);
            }
            data.extend_from_slice(&table.data);
        }
        while data.len() % 4 != 0 {
            data.push(0);
        }

        data
    }

    fn name_table(names: &[TestName]) -> Vec<u8> {
        let storage_offset = 6 + names.len() * 12;
        let mut data = Vec::with_capacity(storage_offset);
        push_u16(&mut data, 0);
        push_u16(&mut data, names.len() as u16);
        push_u16(&mut data, storage_offset as u16);

        let mut storage = Vec::new();
        for name in names {
            let offset = storage.len();
            for unit in name.value.encode_utf16() {
                push_u16(&mut storage, unit);
            }

            push_u16(&mut data, 3);
            push_u16(&mut data, 1);
            push_u16(&mut data, name.language_id);
            push_u16(&mut data, name.name_id);
            push_u16(&mut data, (storage.len() - offset) as u16);
            push_u16(&mut data, offset as u16);
        }
        data.extend_from_slice(&storage);
        data
    }

    fn head_table() -> Vec<u8> {
        let mut data = vec![0; 54];
        data[18..20].copy_from_slice(&1000u16.to_be_bytes());
        data
    }

    fn hhea_table() -> Vec<u8> {
        let mut data = vec![0; 36];
        data[34..36].copy_from_slice(&1u16.to_be_bytes());
        data
    }

    fn maxp_table() -> Vec<u8> {
        let mut data = Vec::with_capacity(6);
        push_u32(&mut data, 0x0001_0000);
        push_u16(&mut data, 1);
        data
    }

    fn os2_table(weight: u16) -> Vec<u8> {
        let mut data = vec![0; 78];
        data[4..6].copy_from_slice(&weight.to_be_bytes());
        data[6..8].copy_from_slice(&5u16.to_be_bytes());
        data
    }

    fn align4(value: usize) -> usize {
        (value + 3) & !3
    }

    fn push_u16(data: &mut Vec<u8>, value: u16) {
        data.extend_from_slice(&value.to_be_bytes());
    }

    fn push_u32(data: &mut Vec<u8>, value: u32) {
        data.extend_from_slice(&value.to_be_bytes());
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_font_data, read_u32, test_support};

    #[test]
    fn parses_minimal_font_metadata_and_weight() {
        let (extension, faces) = parse_font_data(&test_support::font_bytes(700)).unwrap();
        let font = &faces[0];

        assert_eq!(extension, "ttf");
        assert_eq!(faces.len(), 1);
        assert_eq!(font.family, "Test Font");
        assert_eq!(font.display_family, "测试字体");
        assert_eq!(font.subfamily.as_deref(), Some("Bold"));
        assert_eq!(font.full_name.as_deref(), Some("测试字体 粗体"));
        assert_eq!(font.postscript_name.as_deref(), Some("TestFont-Bold"));
        assert_eq!(
            font.family_aliases,
            vec!["Test Font".to_string(), "测试字体".to_string()]
        );
        assert_eq!(font.weight, Some(700));
        assert_eq!(font.path, None);
        assert_eq!(font.face_index, 0);
    }

    #[test]
    fn selects_english_as_canonical_and_simplified_chinese_for_display() {
        let (_, faces) = parse_font_data(&test_support::font_bytes(400)).unwrap();
        let font = &faces[0];

        assert_eq!(font.family, "Test Font");
        assert_eq!(font.display_family, "测试字体");
        assert_eq!(font.subfamily.as_deref(), Some("Regular"));
        assert_eq!(font.full_name.as_deref(), Some("测试字体 常规"));
    }

    #[test]
    fn parses_every_collection_face_with_its_index() {
        let (extension, faces) = parse_font_data(&test_support::collection_bytes()).unwrap();

        assert_eq!(extension, "ttc");
        assert_eq!(faces.len(), 2);
        assert_eq!(
            faces.iter().map(|face| face.face_index).collect::<Vec<_>>(),
            vec![0, 1]
        );
        assert_eq!(
            faces.iter().map(|face| face.weight).collect::<Vec<_>>(),
            vec![Some(400), Some(700)]
        );
        assert!(faces.iter().all(|face| face.path.is_none()));
    }

    #[test]
    fn uses_otf_and_otc_extensions_for_opentype_signatures() {
        let mut otf = test_support::font_bytes(400);
        otf[..4].copy_from_slice(b"OTTO");
        assert_eq!(parse_font_data(&otf).unwrap().0, "otf");

        let mut otc = test_support::collection_bytes();
        let face_count = read_u32(&otc, 8).unwrap();
        for face_index in 0..face_count as usize {
            let offset = read_u32(&otc, 12 + face_index * 4).unwrap() as usize;
            otc[offset..offset + 4].copy_from_slice(b"OTTO");
        }
        assert_eq!(parse_font_data(&otc).unwrap().0, "otc");
    }

    #[test]
    fn accepts_mixed_collection_signatures_and_uses_otc_when_any_face_is_opentype() {
        let mut collection = test_support::collection_bytes();
        let first_offset = read_u32(&collection, 12).unwrap() as usize;
        collection[first_offset..first_offset + 4].copy_from_slice(b"OTTO");

        let (extension, faces) = parse_font_data(&collection).unwrap();
        assert_eq!(extension, "otc");
        assert_eq!(faces.len(), 2);
    }

    #[test]
    fn rejects_unsupported_signatures_and_invalid_faces() {
        assert!(parse_font_data(b"not-a-font").is_err());
        assert!(parse_font_data(&[0, 1, 0, 0]).is_err());

        let mut collection = test_support::collection_bytes();
        let second_offset = read_u32(&collection, 16).unwrap() as usize;
        collection[second_offset..second_offset + 4].copy_from_slice(b"bad!");
        assert!(parse_font_data(&collection).is_err());
    }

    #[test]
    fn rejects_collection_headers_that_cannot_be_safely_walked() {
        let mut data = Vec::new();
        data.extend_from_slice(b"ttcf");
        data.extend_from_slice(&0x0001_0000u32.to_be_bytes());
        data.extend_from_slice(&u32::MAX.to_be_bytes());
        assert!(parse_font_data(&data).is_err());
    }
}
