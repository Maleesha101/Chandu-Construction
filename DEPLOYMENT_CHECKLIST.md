# ✅ Production Deployment Checklist

Use this checklist when deploying to production.

## Pre-Deployment

### Environment Configuration
- [ ] Copy `.env.example` to `.env` in backend directory
- [ ] Set `NODE_ENV=production`
- [ ] Configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`
- [ ] Set strong `DB_PASSWORD` (no defaults)
- [ ] Generate and set `JWT_SECRET` (minimum 32 characters)
  ```bash
  openssl rand -base64 32
  ```
- [ ] Set `CORS_ORIGIN` to production domain(s)
- [ ] Configure `PORT` (default: 5000)
- [ ] (Optional) Set `SENTRY_DSN` for error monitoring

### Dependencies
- [ ] Run `npm install` in backend directory
- [ ] Verify no vulnerabilities: `npm audit`
- [ ] Fix any critical vulnerabilities: `npm audit fix`

### Database
- [ ] Create production database
- [ ] Run `schema.sql` to create tables
- [ ] Run all migrations in order (002-017)
- [ ] Verify all tables exist
- [ ] Create initial admin user
- [ ] Test database connectivity

### Testing
- [ ] Run test suite: `npm test`
- [ ] Verify all tests pass
- [ ] Check test coverage: `npm test -- --coverage`
- [ ] Run health check endpoint manually

### Security
- [ ] No hardcoded credentials in code
- [ ] `.env` file is in `.gitignore`
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] Database password is strong
- [ ] Rate limiting is enabled
- [ ] Helmet security headers are active
- [ ] CORS is properly configured

## Deployment

### Docker Deployment (Recommended)
- [ ] Review `docker-compose.yml`
- [ ] Ensure `.env` is configured
- [ ] Build images: `docker-compose build`
- [ ] Start services: `docker-compose up -d`
- [ ] Check container status: `docker-compose ps`
- [ ] View logs: `docker-compose logs -f`
- [ ] Verify health: `curl http://localhost:5000/api/health`

### Manual Deployment
- [ ] Build TypeScript: `npm run build`
- [ ] Test production build locally: `npm start`
- [ ] Copy `dist/` to production server
- [ ] Copy `node_modules/` to production server
- [ ] Copy `.env` to production server
- [ ] Set up process manager (PM2/systemd)
- [ ] Configure Nginx reverse proxy
- [ ] Set up SSL/TLS with Let's Encrypt

### SSL/TLS Configuration
- [ ] Install certbot
- [ ] Generate SSL certificate
  ```bash
  sudo certbot --nginx -d api.yourdomain.com
  ```
- [ ] Verify HTTPS works
- [ ] Set up auto-renewal
- [ ] Test SSL with: https://www.ssllabs.com/ssltest/

### Reverse Proxy (Nginx)
- [ ] Install Nginx
- [ ] Configure proxy to backend
- [ ] Enable gzip compression
- [ ] Set up rate limiting (additional layer)
- [ ] Configure security headers
- [ ] Test configuration: `nginx -t`
- [ ] Reload: `systemctl reload nginx`

## Post-Deployment

### Monitoring Setup
- [ ] Verify logging is working (`logs/` directory)
- [ ] Set up log rotation
- [ ] Configure Sentry error monitoring
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Configure alerts for critical errors
- [ ] Test health check endpoints
  - [ ] `/api/health` - Full health
  - [ ] `/api/ready` - Readiness
  - [ ] `/api/live` - Liveness

### Backup Configuration
- [ ] Verify automated backups are running (Docker)
- [ ] Or set up cron job for manual backup (`scripts/backup.sh`)
- [ ] Test backup process
- [ ] Test restore process
- [ ] Configure backup retention (default: 30 days)
- [ ] (Optional) Set up cloud backup (S3, Google Cloud Storage)

### Security Hardening
- [ ] Configure firewall (ufw/iptables)
  ```bash
  sudo ufw allow 22    # SSH
  sudo ufw allow 80    # HTTP
  sudo ufw allow 443   # HTTPS
  sudo ufw enable
  ```
- [ ] Restrict database access to localhost only
- [ ] Disable root SSH login
- [ ] Set up fail2ban for SSH protection
- [ ] Review PostgreSQL security settings
- [ ] Enable SSL for database connections (if external)

### Performance Optimization
- [ ] Enable compression in Nginx
- [ ] Configure connection pooling (already set: max 20)
- [ ] Set up CDN for static assets (if applicable)
- [ ] Configure caching headers
- [ ] Monitor slow queries (auto-logged if >1s)

### User Management
- [ ] Create admin user account
- [ ] Change default passwords
- [ ] Test user registration (if enabled)
- [ ] Test login with new password requirements
- [ ] Verify role-based access control

### Testing in Production
- [ ] Test health endpoint: `curl https://api.yourdomain.com/api/health`
- [ ] Test authentication endpoints
  - [ ] Register new user
  - [ ] Login with credentials
  - [ ] Try login with wrong password (should rate limit after 5 attempts)
- [ ] Test CRUD operations
  - [ ] Create expense
  - [ ] Update expense
  - [ ] Delete expense
- [ ] Test rate limiting
  - [ ] Make 101+ requests quickly (should get 429 error)
- [ ] Test password change
- [ ] Verify logs are being written
- [ ] Check Sentry for test errors (if configured)

## Verification

### Functional Tests
- [ ] Boss user can access all features
- [ ] Admin user has correct permissions
- [ ] QS user has limited access
- [ ] MD user can see their data only
- [ ] Worker user has minimal access
- [ ] Approval workflow works correctly
- [ ] Bank transfers work
- [ ] Reports generate correctly

### Performance Tests
- [ ] API responds within acceptable time (<500ms)
- [ ] Database queries are optimized
- [ ] No memory leaks over 24 hours
- [ ] Concurrent user handling (load test)

### Security Tests
- [ ] SQL injection attempts are blocked
- [ ] XSS attempts are blocked
- [ ] CSRF protection works
- [ ] Rate limiting works on all endpoints
- [ ] Authentication is required for protected routes
- [ ] Authorization prevents unauthorized access

## Documentation

- [ ] Update README with production URLs
- [ ] Document any custom configuration
- [ ] Create runbook for common issues
- [ ] Document backup and restore procedures
- [ ] Share credentials securely with team

## Monitoring & Alerts

### Set Up Alerts For:
- [ ] API downtime (health check fails)
- [ ] High error rate (>5% of requests)
- [ ] Database connection failures
- [ ] Disk space low (<20%)
- [ ] High memory usage (>80%)
- [ ] Failed backups
- [ ] SSL certificate expiration (<30 days)

### Monitor These Metrics:
- [ ] Request rate (requests per minute)
- [ ] Error rate (errors per minute)
- [ ] Response time (p50, p95, p99)
- [ ] Database query time
- [ ] Memory usage
- [ ] CPU usage
- [ ] Disk space
- [ ] Active connections

## Rollback Plan

Have a rollback plan ready:

- [ ] Document current version number
- [ ] Keep previous Docker image/build
- [ ] Document rollback steps
- [ ] Test rollback procedure
- [ ] Have database backup before migration
- [ ] Know how to restore from backup

### Quick Rollback (Docker):
```bash
docker-compose down
# Switch to previous version
docker-compose up -d
```

### Quick Rollback (Manual):
```bash
pm2 stop chandu-backend
# Restore previous build
pm2 start chandu-backend
```

## Final Sign-Off

Before making the system live:

- [ ] All checklist items above are complete
- [ ] Team has reviewed deployment
- [ ] Backup and restore tested successfully
- [ ] Monitoring and alerts are active
- [ ] Documentation is up to date
- [ ] Stakeholders are notified
- [ ] Support team is ready
- [ ] Rollback plan is documented and tested

## Post-Launch

### Day 1:
- [ ] Monitor error rates closely
- [ ] Watch for unusual traffic patterns
- [ ] Check logs frequently
- [ ] Verify backups ran successfully
- [ ] Respond to any issues immediately

### Week 1:
- [ ] Review performance metrics
- [ ] Analyze slow queries
- [ ] Check disk space trends
- [ ] Review Sentry errors
- [ ] Gather user feedback
- [ ] Document any issues and resolutions

### Month 1:
- [ ] Review security logs
- [ ] Update dependencies: `npm audit`
- [ ] Review and optimize slow queries
- [ ] Check backup retention
- [ ] Performance optimization based on real usage
- [ ] Plan for scaling if needed

---

## Checklist Complete? 🎉

If all items are checked, you're ready for production!

**Remember:**
- Monitor closely for the first 48 hours
- Have the team ready to respond to issues
- Communicate with users about the launch
- Celebrate the successful deployment! 🚀

---

**Deployment Date:** _______________

**Deployed By:** _______________

**Version:** 1.0.0

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________
