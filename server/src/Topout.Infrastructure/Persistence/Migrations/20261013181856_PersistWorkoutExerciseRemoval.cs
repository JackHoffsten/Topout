using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PersistWorkoutExerciseRemoval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int[]>(
                name: "RemovedExerciseIds",
                table: "WorkoutLogs",
                type: "integer[]",
                nullable: false,
                defaultValueSql: "ARRAY[]::integer[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RemovedExerciseIds",
                table: "WorkoutLogs");
        }
    }
}
