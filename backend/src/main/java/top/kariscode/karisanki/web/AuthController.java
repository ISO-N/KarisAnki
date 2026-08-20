package top.kariscode.karisanki.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;

import top.kariscode.karisanki.security.SessionRegistryService;
import top.kariscode.karisanki.security.UserPrincipal;
import top.kariscode.karisanki.service.AuthService;
import top.kariscode.karisanki.web.dto.AuthDtos;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;
	private final SessionRegistryService sessionRegistryService;

	public AuthController(AuthService authService, SessionRegistryService sessionRegistryService) {
		this.authService = authService;
		this.sessionRegistryService = sessionRegistryService;
	}

	@GetMapping("/registration-status")
	public AuthDtos.RegistrationStatusResponse registrationStatus() {
		return authService.registrationStatus();
	}

	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public AuthDtos.UserResponse register(@Valid @RequestBody AuthDtos.RegisterRequest request,
			HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
		return authService.register(request, servletRequest, servletResponse);
	}

	@PostMapping("/login")
	public AuthDtos.UserResponse login(@Valid @RequestBody AuthDtos.LoginRequest request,
			HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
		return authService.login(request, servletRequest, servletResponse);
	}

	@GetMapping("/me")
	public AuthDtos.UserResponse me(@AuthenticationPrincipal UserPrincipal principal) {
		return authService.currentUser(principal.id());
	}

	@PostMapping("/logout")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void logout(HttpServletRequest request) {
		sessionRegistryService.logoutCurrent(request);
	}

	@PostMapping("/logout-all")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void logoutAll(@AuthenticationPrincipal UserPrincipal principal, HttpServletRequest request) {
		sessionRegistryService.logoutAll(request, principal.id());
	}
}
