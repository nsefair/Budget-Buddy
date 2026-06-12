package mailer

import (
	"context"
	"fmt"
	"log/slog"
	"net/mail"
	"net/smtp"
	"strings"

	"budget-buddy/backend/internal/config"
)

type Message struct {
	To      string
	Subject string
	Text    string
}

type Sender interface {
	Send(context.Context, Message) error
}

func New(cfg config.Config, logger *slog.Logger) Sender {
	if cfg.EmailDeliveryMode == "smtp" {
		return &smtpSender{cfg: cfg}
	}
	return &logSender{logger: logger, includeBody: cfg.Env != "production"}
}

type logSender struct {
	logger      *slog.Logger
	includeBody bool
}

func (s *logSender) Send(_ context.Context, message Message) error {
	attributes := []any{"to", message.To, "subject", message.Subject}
	if s.includeBody {
		attributes = append(attributes, "body", message.Text)
	}
	s.logger.Info("email queued in log delivery mode", attributes...)
	return nil
}

type smtpSender struct {
	cfg config.Config
}

func (s *smtpSender) Send(_ context.Context, message Message) error {
	from, err := mail.ParseAddress(s.cfg.EmailFrom)
	if err != nil {
		return fmt.Errorf("parse EMAIL_FROM: %w", err)
	}
	to, err := mail.ParseAddress(message.To)
	if err != nil {
		return fmt.Errorf("parse recipient: %w", err)
	}

	auth := smtp.PlainAuth("", s.cfg.SMTPUsername, s.cfg.SMTPPassword, s.cfg.SMTPHost)
	body := strings.Join([]string{
		"From: " + s.cfg.EmailFrom,
		"To: " + to.String(),
		"Subject: " + cleanHeader(message.Subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		message.Text,
	}, "\r\n")

	if err := smtp.SendMail(s.cfg.SMTPAddress(), auth, from.Address, []string{to.Address}, []byte(body)); err != nil {
		return fmt.Errorf("send SMTP message: %w", err)
	}
	return nil
}

func cleanHeader(value string) string {
	value = strings.ReplaceAll(value, "\r", " ")
	return strings.ReplaceAll(value, "\n", " ")
}
