class CalendarApp {
    constructor() {
        this.lessons = new Map(); // Store all created lessons
        this.scheduledLessons = new Map(); // Store scheduled lessons by slot
        this.currentLessonId = 0;
        this.editingLessonId = null;
        this.dragSource = null; // Track drag source
        
        this.init();
        this.loadFromStorage();
    }

    init() {
        this.generateCalendarGrid();
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    generateCalendarGrid() {
        const grid = document.getElementById('calendarGrid');
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const hours = [16, 17, 18, 19, 20, 21]; // 16-22 (21:xx slot è l'ultimo)

        for (let hour = 0; hour < hours.length; hour++) {
            // Time column
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.textContent = `${hours[hour]}:00`;
            grid.appendChild(timeSlot);

            // Day slots
            for (let day = 0; day < days.length; day++) {
                const daySlot = document.createElement('div');
                daySlot.className = 'day-slot';
                daySlot.dataset.day = days[day];
                daySlot.dataset.hour = hours[hour];
                daySlot.dataset.slotId = `${days[day]}-${hours[hour]}`;
                grid.appendChild(daySlot);
            }
        }
    }

    setupEventListeners() {
        // Add lesson button
        document.getElementById('addLessonBtn').addEventListener('click', () => {
            this.showCreateLessonForm();
        });

        // Clear all button
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            if (confirm('⚠️ Sei sicuro di voler cancellare tutto il calendario?')) {
                this.clearAll();
            }
        });

        // Create lesson button
        document.getElementById('createLessonBtn').addEventListener('click', () => {
            this.createLesson();
        });

        // Modal events
        this.setupModalEvents();

        // Calendar slot clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.lesson-in-calendar')) {
                const lessonElement = e.target.closest('.lesson-in-calendar');
                const lessonId = parseInt(lessonElement.dataset.lessonId);
                this.editLesson(lessonId);
            }
        });
    }

    setupModalEvents() {
        const modal = document.getElementById('editModal');
        const closeBtn = document.querySelector('.close');
        const cancelBtn = document.getElementById('cancelEditBtn');
        const saveBtn = document.getElementById('saveChangesBtn');
        const deleteBtn = document.getElementById('deleteLessonBtn');

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        saveBtn.addEventListener('click', () => {
            this.saveEditedLesson();
        });

        deleteBtn.addEventListener('click', () => {
            if (confirm('🗑️ Sei sicuro di voler eliminare questa lezione?')) {
                this.deleteLesson(this.editingLessonId);
                modal.style.display = 'none';
            }
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    setupDragAndDrop() {
        // Make lesson blocks and calendar lessons draggable
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('lesson-block') || e.target.classList.contains('lesson-in-calendar')) {
                e.dataTransfer.setData('text/plain', e.target.dataset.lessonId);
                this.dragSource = e.target.classList.contains('lesson-block') ? 'panel' : 'calendar';
                e.dataTransfer.setData('source', this.dragSource);
                e.target.classList.add('dragging');
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('lesson-block') || e.target.classList.contains('lesson-in-calendar')) {
                e.target.classList.remove('dragging');
                this.dragSource = null;
                // Remove any drag over styles
                document.querySelector('.lesson-panel')?.classList.remove('drag-over-panel');
            }
        });

        // Setup drop zones for calendar slots
        document.addEventListener('dragover', (e) => {
            if (e.target.classList.contains('day-slot')) {
                e.preventDefault();
                e.target.classList.add('drag-over');
            }
            // Allow drop on lesson panel to unschedule lessons
            if (e.target.closest('.lesson-panel')) {
                e.preventDefault();
                const panel = document.querySelector('.lesson-panel');
                if (this.dragSource === 'calendar') {
                    panel.classList.add('drag-over-panel');
                }
            }
        });

        document.addEventListener('dragleave', (e) => {
            if (e.target.classList.contains('day-slot')) {
                e.target.classList.remove('drag-over');
            }
            // Remove panel highlight when leaving
            if (e.target.closest('.lesson-panel') && !e.target.closest('.lesson-panel').contains(e.relatedTarget)) {
                const panel = document.querySelector('.lesson-panel');
                panel.classList.remove('drag-over-panel');
            }
        });

        document.addEventListener('drop', (e) => {
            const lessonId = parseInt(e.dataTransfer.getData('text/plain'));
            const source = e.dataTransfer.getData('source');
            
            if (e.target.classList.contains('day-slot')) {
                e.preventDefault();
                e.target.classList.remove('drag-over');
                
                const slotId = e.target.dataset.slotId;
                this.scheduleLesson(lessonId, slotId);
            }
            // Drop on lesson panel to unschedule
            else if (e.target.closest('.lesson-panel') && source === 'calendar') {
                e.preventDefault();
                const panel = document.querySelector('.lesson-panel');
                panel.classList.remove('drag-over-panel');
                this.unscheduleLesson(lessonId);
            }
        });
    }

    showCreateLessonForm() {
        document.getElementById('lessonTitle').focus();
    }

    createLesson() {
        const title = document.getElementById('lessonTitle').value.trim();
        const student = document.getElementById('lessonStudent').value.trim();
        const color = document.getElementById('lessonColor').value;

        if (!title) {
            alert('⚠️ Inserisci un titolo per la lezione');
            return;
        }

        const lessonId = ++this.currentLessonId;
        const lesson = {
            id: lessonId,
            title,
            student,
            color,
            scheduled: false,
            slotId: null
        };

        this.lessons.set(lessonId, lesson);
        this.renderAvailableLessons();
        this.clearCreateForm();
        this.saveToStorage();

        // Show success message
        this.showNotification(`✅ Lezione "${title}" creata con successo!`);
    }

    renderAvailableLessons() {
        const container = document.getElementById('availableLessons');
        const existingList = container.querySelector('.lessons-list');
        
        if (existingList) {
            existingList.remove();
        }

        const lessonsList = document.createElement('div');
        lessonsList.className = 'lessons-list';

        // Filter unscheduled lessons
        const unscheduledLessons = Array.from(this.lessons.values())
            .filter(lesson => !lesson.scheduled);

        if (unscheduledLessons.length === 0) {
            lessonsList.innerHTML = '<p class="help-text">Nessuna lezione disponibile. Creane una nuova!</p>';
        } else {
            unscheduledLessons.forEach(lesson => {
                const lessonBlock = this.createLessonBlock(lesson);
                lessonsList.appendChild(lessonBlock);
            });
        }

        container.appendChild(lessonsList);
    }

    createLessonBlock(lesson) {
        const block = document.createElement('div');
        block.className = `lesson-block ${lesson.color}`;
        block.draggable = true;
        block.dataset.lessonId = lesson.id;

        block.innerHTML = `
            <div class="title">${lesson.title}</div>
            ${lesson.student ? `<div class="student">${lesson.student}</div>` : ''}
        `;

        return block;
    }

    scheduleLesson(lessonId, slotId) {
        const lesson = this.lessons.get(lessonId);
        if (!lesson) return;

        // Check if slot is already occupied
        if (this.scheduledLessons.has(slotId)) {
            // Move existing lesson back to available
            const existingLessonId = this.scheduledLessons.get(slotId);
            const existingLesson = this.lessons.get(existingLessonId);
            if (existingLesson) {
                existingLesson.scheduled = false;
                existingLesson.slotId = null;
            }
        }

        // If lesson was already scheduled elsewhere, free the old slot
        if (lesson.scheduled && lesson.slotId) {
            this.scheduledLessons.delete(lesson.slotId);
            this.clearSlot(lesson.slotId);
        }

        // Schedule the lesson
        lesson.scheduled = true;
        lesson.slotId = slotId;
        this.scheduledLessons.set(slotId, lessonId);

        this.renderCalendar();
        this.renderAvailableLessons();
        this.saveToStorage();

        // Show success message
        const [day, hour] = slotId.split('-');
        const dayName = this.getDayName(day);
        this.showNotification(`📅 Lezione "${lesson.title}" programmata per ${dayName} alle ${hour}:00`);
    }

    unscheduleLesson(lessonId) {
        const lesson = this.lessons.get(lessonId);
        if (!lesson || !lesson.scheduled) return;

        // Remove from scheduled lessons
        this.scheduledLessons.delete(lesson.slotId);
        this.clearSlot(lesson.slotId);

        // Mark as unscheduled
        lesson.scheduled = false;
        lesson.slotId = null;

        this.renderCalendar();
        this.renderAvailableLessons();
        this.saveToStorage();

        this.showNotification(`↩️ Lezione "${lesson.title}" rimossa dal calendario`);
    }

    renderCalendar() {
        // Clear all existing lessons from calendar
        document.querySelectorAll('.lesson-in-calendar').forEach(el => el.remove());

        // Render scheduled lessons
        this.scheduledLessons.forEach((lessonId, slotId) => {
            const lesson = this.lessons.get(lessonId);
            if (lesson) {
                this.renderLessonInSlot(lesson, slotId);
            }
        });
    }

    renderLessonInSlot(lesson, slotId) {
        const slot = document.querySelector(`[data-slot-id="${slotId}"]`);
        if (!slot) return;

        const lessonElement = document.createElement('div');
        lessonElement.className = `lesson-in-calendar ${lesson.color}`;
        lessonElement.dataset.lessonId = lesson.id;
        lessonElement.draggable = true; // Make it draggable

        lessonElement.innerHTML = `
            <div class="title">${lesson.title}</div>
            ${lesson.student ? `<div class="student">${lesson.student}</div>` : ''}
        `;

        slot.appendChild(lessonElement);
    }

    clearSlot(slotId) {
        const slot = document.querySelector(`[data-slot-id="${slotId}"]`);
        if (slot) {
            const lessonElement = slot.querySelector('.lesson-in-calendar');
            if (lessonElement) {
                lessonElement.remove();
            }
        }
    }

    editLesson(lessonId) {
        const lesson = this.lessons.get(lessonId);
        if (!lesson) return;

        this.editingLessonId = lessonId;

        // Populate modal form
        document.getElementById('editTitle').value = lesson.title;
        document.getElementById('editStudent').value = lesson.student || '';
        document.getElementById('editColor').value = lesson.color;

        // Show modal
        document.getElementById('editModal').style.display = 'block';
    }

    saveEditedLesson() {
        const lesson = this.lessons.get(this.editingLessonId);
        if (!lesson) return;

        const title = document.getElementById('editTitle').value.trim();
        const student = document.getElementById('editStudent').value.trim();
        const color = document.getElementById('editColor').value;

        if (!title) {
            alert('⚠️ Inserisci un titolo per la lezione');
            return;
        }

        lesson.title = title;
        lesson.student = student;
        lesson.color = color;

        this.renderCalendar();
        this.renderAvailableLessons();
        this.saveToStorage();

        document.getElementById('editModal').style.display = 'none';
        this.showNotification(`✅ Lezione "${title}" aggiornata con successo!`);
    }

    deleteLesson(lessonId) {
        const lesson = this.lessons.get(lessonId);
        if (!lesson) return;

        // Remove from calendar if scheduled
        if (lesson.scheduled && lesson.slotId) {
            this.scheduledLessons.delete(lesson.slotId);
            this.clearSlot(lesson.slotId);
        }

        // Remove from lessons
        this.lessons.delete(lessonId);

        this.renderCalendar();
        this.renderAvailableLessons();
        this.saveToStorage();

        this.showNotification(`🗑️ Lezione "${lesson.title}" eliminata`);
    }

    clearAll() {
        this.lessons.clear();
        this.scheduledLessons.clear();
        this.currentLessonId = 0;
        
        this.renderCalendar();
        this.renderAvailableLessons();
        this.clearCreateForm();
        this.saveToStorage();

        this.showNotification('🧹 Calendario completamente svuotato');
    }

    clearCreateForm() {
        document.getElementById('lessonTitle').value = '';
        document.getElementById('lessonStudent').value = '';
        document.getElementById('lessonColor').value = 'blue';
    }

    getDayName(day) {
        const days = {
            'monday': 'Lunedì',
            'tuesday': 'Martedì',
            'wednesday': 'Mercoledì',
            'thursday': 'Giovedì',
            'friday': 'Venerdì'
        };
        return days[day] || day;
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #48bb78;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1001;
            font-weight: 600;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    saveToStorage() {
        const data = {
            lessons: Array.from(this.lessons.entries()),
            scheduledLessons: Array.from(this.scheduledLessons.entries()),
            currentLessonId: this.currentLessonId
        };
        localStorage.setItem('calendarApp', JSON.stringify(data));
    }

    loadFromStorage() {
        const data = localStorage.getItem('calendarApp');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.lessons = new Map(parsed.lessons || []);
                this.scheduledLessons = new Map(parsed.scheduledLessons || []);
                this.currentLessonId = parsed.currentLessonId || 0;

                this.renderCalendar();
                this.renderAvailableLessons();
            } catch (error) {
                console.error('Errore nel caricamento dei dati:', error);
            }
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CalendarApp();
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);
