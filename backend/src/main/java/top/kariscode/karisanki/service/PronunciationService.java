package top.kariscode.karisanki.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

@Service
public class PronunciationService {

	private final Resource dictionaryResource;
	private volatile Map<String, String> dictionary;

	public PronunciationService(
			@Value("classpath:pronunciation/cmudict-0.7b-ipa.txt") Resource dictionaryResource) {
		this.dictionaryResource = dictionaryResource;
	}

	public String phoneticFor(String front) {
		String plain = cleanMarkdown(front);
		if (!isSingleEnglishWord(plain)) {
			return null;
		}
		String ipa = dictionary().get(normalizeWord(plain));
		return ipa == null ? null : firstVariant(ipa);
	}

	public boolean isSingleEnglishWord(String front) {
		return cleanMarkdown(front).matches("[A-Za-z][A-Za-z'’\\-]*");
	}

	private Map<String, String> dictionary() {
		Map<String, String> loaded = dictionary;
		if (loaded != null) {
			return loaded;
		}
		synchronized (this) {
			if (dictionary == null) {
				dictionary = loadDictionary();
			}
			return dictionary;
		}
	}

	private Map<String, String> loadDictionary() {
		Map<String, String> values = new HashMap<>();
		try (InputStream input = dictionaryResource.getInputStream();
				BufferedReader reader = new BufferedReader(
						new InputStreamReader(input, StandardCharsets.UTF_8))) {
			String line;
			while ((line = reader.readLine()) != null) {
				if (line.isBlank()) {
					continue;
				}
				int separator = line.indexOf('\t');
				if (separator <= 0 || separator == line.length() - 1) {
					continue;
				}
				String word = line.substring(0, separator).trim().toLowerCase(Locale.ROOT);
				String ipa = line.substring(separator + 1).trim();
				if (!word.isBlank() && !ipa.isBlank()) {
					values.put(word, ipa);
				}
			}
		} catch (IOException exception) {
			throw new IllegalStateException("无法加载本地发音词典", exception);
		}
		return values;
	}

	private String cleanMarkdown(String front) {
		if (front == null) {
			return "";
		}
		String text = front;
		text = text.replaceAll("!\\[[^\\]]*\\]\\([^)]*\\)", "");
		text = text.replaceAll("\\[[^\\]]*\\]\\([^)]*\\)", "$1");
		text = text.replaceAll("<[^>]+>", "");
		text = text.replaceAll("[*_`~#>]", "");
		return text.trim();
	}

	private String normalizeWord(String word) {
		return word.replace('’', '\'')
				.replace('‘', '\'')
				.replace('‑', '-')
				.toLowerCase(Locale.ROOT);
	}

	private String firstVariant(String ipa) {
		String first = ipa;
		int comma = first.indexOf(',');
		if (comma >= 0) {
			first = first.substring(0, comma);
		}
		return first.trim();
	}
}
