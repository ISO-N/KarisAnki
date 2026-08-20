package top.kariscode.karisanki.security;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import top.kariscode.karisanki.domain.user.User;
import top.kariscode.karisanki.repository.UserRepository;

@Service
public class KarisUserDetailsService implements UserDetailsService {

	private final UserRepository userRepository;

	public KarisUserDetailsService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	@Override
	public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
		User user = userRepository.findByEmail(username.toLowerCase().trim())
				.orElseThrow(() -> new UsernameNotFoundException("邮箱或密码错误"));
		return new UserPrincipal(user.getId(), user.getEmail(), user.getPasswordHash());
	}
}
