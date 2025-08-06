# Requirements Document

## Introduction

This document outlines the requirements for a mobile-friendly web application that enables front desk administrators to scan QR codes for event check-ins. The application will integrate with an existing Supabase PostgreSQL database containing registration data from Koalendar bookings processed through n8n. The primary goal is to streamline the check-in process by allowing admins to scan QR codes, view attendee information, and update actual guest counts during events.

## Requirements

### Requirement 1

**User Story:** As a front desk admin, I want to scan QR codes using my mobile device, so that I can quickly identify and check in attendees.

#### Acceptance Criteria

1. WHEN the admin opens the application THEN the system SHALL display a camera interface for QR code scanning
2. WHEN a QR code is scanned THEN the system SHALL decode the QR code and extract the booking identifier
3. WHEN the QR code contains valid booking data THEN the system SHALL retrieve the corresponding registration record from the database
4. IF the QR code is invalid or unreadable THEN the system SHALL display an error message and allow retry
5. WHEN scanning is successful THEN the system SHALL display the attendee information screen
6. WHEN QR code scanning fails or is unavailable THEN the system SHALL provide an option to manually search by booking ID
7. WHEN manual search is selected THEN the system SHALL provide a search input field for the first 5 characters of the koalendar_id
8. WHEN a partial koalendar_id is entered THEN the system SHALL search the database for matching records and display results
9. WHEN multiple matches are found THEN the system SHALL display a list of matching bookings for admin selection

### Requirement 2

**User Story:** As a front desk admin, I want to view comprehensive attendee information after scanning, so that I can verify the booking details and guest count.

#### Acceptance Criteria

1. WHEN attendee information is displayed THEN the system SHALL show the attendee's name, email, and contact number
2. WHEN attendee information is displayed THEN the system SHALL show the booking details including event start/end times and expected number of guests
3. WHEN attendee information is displayed THEN the system SHALL show the attendee's student status and postcode
4. WHEN attendee information is displayed THEN the system SHALL show the current check-in status (attended/not attended)
5. IF the attendee has already been checked in THEN the system SHALL display the previous check-in timestamp and actual guest count

### Requirement 3

**User Story:** As a front desk admin, I want to update the actual number of guests during check-in, so that I can record accurate attendance data.

#### Acceptance Criteria

1. WHEN viewing attendee information THEN the system SHALL provide an input field for actual guest count
2. WHEN the actual guest count is entered THEN the system SHALL validate that the number is a positive integer
3. WHEN the actual guest count is entered THEN the system SHALL allow the admin to confirm the check-in
4. WHEN check-in is confirmed THEN the system SHALL update the database with is_attended=true, attended_at=current timestamp, and actual_num_guests=entered value
5. WHEN the database update is successful THEN the system SHALL display a confirmation message

### Requirement 4

**User Story:** As a front desk admin, I want the application to work seamlessly on mobile devices, so that I can use tablets and phones for check-ins.

#### Acceptance Criteria

1. WHEN the application loads on any mobile device THEN the system SHALL display a responsive interface optimized for touch interaction
2. WHEN using the camera for QR scanning THEN the system SHALL utilize the device's rear camera by default
3. WHEN interacting with form elements THEN the system SHALL provide appropriately sized touch targets (minimum 44px)
4. WHEN viewing attendee information THEN the system SHALL display content in a mobile-optimized layout with readable text sizes
5. WHEN the device orientation changes THEN the system SHALL maintain usability in both portrait and landscape modes

### Requirement 5

**User Story:** As a front desk admin, I want to handle network connectivity issues gracefully, so that I can continue working even with intermittent internet connection.

#### Acceptance Criteria

1. WHEN the database connection fails THEN the system SHALL display an appropriate error message
2. WHEN a database operation times out THEN the system SHALL allow the admin to retry the operation
3. WHEN the network is unavailable THEN the system SHALL inform the admin about the connectivity issue
4. WHEN the network connection is restored THEN the system SHALL automatically retry failed operations
5. WHEN critical operations fail THEN the system SHALL provide clear guidance on next steps

### Requirement 6

**User Story:** As a front desk admin, I want to prevent duplicate check-ins, so that attendance data remains accurate.

#### Acceptance Criteria

1. WHEN scanning a QR code for an already checked-in attendee THEN the system SHALL display the previous check-in information
2. WHEN an attendee is already checked in THEN the system SHALL show a warning before allowing re-check-in
3. WHEN re-check-in is confirmed THEN the system SHALL update the attended_at timestamp and actual_num_guests
4. WHEN displaying check-in status THEN the system SHALL clearly indicate whether this is a first-time or repeat check-in
5. WHEN multiple check-ins occur THEN the system SHALL maintain the most recent attendance data

### Requirement 7

**User Story:** As a system administrator, I want the application to securely connect to the Supabase database, so that registration data is protected.

#### Acceptance Criteria

1. WHEN the application connects to the database THEN the system SHALL use secure connection protocols (SSL/TLS)
2. WHEN database credentials are stored THEN the system SHALL use environment variables for sensitive configuration
3. WHEN database queries are executed THEN the system SHALL use parameterized queries to prevent SQL injection
4. WHEN authentication is required THEN the system SHALL implement proper access controls
5. WHEN errors occur THEN the system SHALL log errors without exposing sensitive database information