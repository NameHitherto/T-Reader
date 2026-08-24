use crate::entities::KnowledgeChunkRecord;

pub fn normalize_vector(vector: &mut [f32]) {
    let norm_sq: f32 = vector.iter().map(|value| value * value).sum();
    let norm = norm_sq.sqrt();
    if norm <= f32::EPSILON {
        return;
    }

    for value in vector.iter_mut() {
        *value /= norm;
    }
}

pub fn vector_to_bytes(vector: &[f32]) -> Vec<u8> {
    vector
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect()
}

pub fn bytes_to_vector(bytes: &[u8]) -> Result<Vec<f32>, String> {
    if bytes.len() % 4 != 0 {
        return Err("向量数据长度无效".to_string());
    }

    Ok(bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect())
}

pub fn dot_product(left: &[f32], right: &[f32]) -> Result<f32, String> {
    if left.len() != right.len() {
        return Err("向量维度不一致".to_string());
    }

    Ok(left.iter().zip(right).map(|(a, b)| a * b).sum())
}

pub fn rank_chunks_by_query(
    query: &[f32],
    chunks: &[KnowledgeChunkRecord],
    limit: usize,
) -> Result<Vec<(usize, f32)>, String> {
    let mut ranked = Vec::with_capacity(chunks.len());

    for (index, chunk) in chunks.iter().enumerate() {
        let vector = bytes_to_vector(&chunk.vector)?;
        let score = dot_product(query, &vector)?;
        ranked.push((index, score));
    }

    ranked.sort_by(|left, right| {
        right
            .1
            .partial_cmp(&left.1)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    ranked.truncate(limit);
    Ok(ranked)
}

#[cfg(test)]
mod tests {
    use super::{bytes_to_vector, dot_product, normalize_vector, vector_to_bytes};

    #[test]
    fn normalizes_unit_length_vector() {
        let mut vector = vec![3.0_f32, 4.0_f32];
        normalize_vector(&mut vector);
        assert!((vector[0] - 0.6).abs() < 0.001);
        assert!((vector[1] - 0.8).abs() < 0.001);
    }

    #[test]
    fn round_trips_vector_bytes() {
        let vector = vec![0.1_f32, -0.2_f32, 0.3_f32];
        let bytes = vector_to_bytes(&vector);
        let decoded = bytes_to_vector(&bytes).unwrap();
        assert_eq!(decoded, vector);
    }

    #[test]
    fn computes_dot_product() {
        assert_eq!(dot_product(&[1.0, 2.0], &[3.0, 4.0]).unwrap(), 11.0);
    }
}
