package top.kariscode.karisanki;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class KarisankiApplication {

	public static void main(String[] args) {
		SpringApplication.run(KarisankiApplication.class, args);
	}

}
