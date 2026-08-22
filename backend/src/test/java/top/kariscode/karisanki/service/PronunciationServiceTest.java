package top.kariscode.karisanki.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

class PronunciationServiceTest {

	private final PronunciationService service = new PronunciationService(
			new ClassPathResource("pronunciation/cmudict-0.7b-ipa.txt"));

	@Test
	void generatesIpaForCommonEnglishWords() {
		assertEquals("ˈæpəl", service.phoneticFor("apple"));
		assertEquals("ˈtʃɪldrən", service.phoneticFor("children"));
		assertEquals("ˈrʌnɪŋ", service.phoneticFor("running"));
	}

	@Test
	void handlesHyphensApostrophesAndMarkdownFormatting() {
		assertEquals("ˈiːˌmeɪl", service.phoneticFor("e-mail"));
		assertEquals("ˈdoʊnt", service.phoneticFor("don't"));
		assertEquals("ˈdoʊnt", service.phoneticFor("don’t"));
		assertEquals("ˈæpəl", service.phoneticFor("**apple**"));
	}

	@Test
	void rejectsPhrasesChineseAndUnknownWords() {
		assertNull(service.phoneticFor("take up"));
		assertNull(service.phoneticFor("苹果"));
		assertNull(service.phoneticFor("zzzqx"));
	}

	@Test
	void detectsOnlySingleEnglishWords() {
		assertTrue(service.isSingleEnglishWord("apple"));
		assertTrue(service.isSingleEnglishWord("e-mail"));
		assertTrue(!service.isSingleEnglishWord("take up"));
		assertTrue(!service.isSingleEnglishWord("苹果"));
	}
}
