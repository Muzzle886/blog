package errs

import "fmt"

type Detail struct {
	Path    string `json:"path"`
	Message string `json:"message"`
}

type Error struct {
	Status  int
	Code    string
	Message string
	Details []Detail
}

func (e *Error) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func New(status int, code, message string, details ...Detail) *Error {
	return &Error{Status: status, Code: code, Message: message, Details: details}
}

func BadRequest(message string) *Error {
	return New(400, "BAD_REQUEST", message)
}

func Validation(message string, details ...Detail) *Error {
	if message == "" {
		message = "参数校验失败"
	}
	return New(422, "VALIDATION_FAILED", message, details...)
}

func Unauthorized(message string) *Error {
	if message == "" {
		message = "请先登录"
	}
	return New(401, "UNAUTHORIZED", message)
}

func Forbidden(message string) *Error {
	if message == "" {
		message = "没有操作权限"
	}
	return New(403, "FORBIDDEN", message)
}

func NotFound(message string) *Error {
	if message == "" {
		message = "资源不存在"
	}
	return New(404, "NOT_FOUND", message)
}

func Conflict(message string) *Error {
	return New(409, "CONFLICT", message)
}

func TooMany(message string) *Error {
	if message == "" {
		message = "操作过于频繁，请稍后再试"
	}
	return New(429, "TOO_MANY_REQUESTS", message)
}

func Is(err error) (*Error, bool) {
	e, ok := err.(*Error)
	return e, ok
}
